import type {
  DOMParserConstructor,
  DOMParserLike,
  LyricLine,
  LyricMetadata,
  LyricResult,
  LyricWord,
  ParseOptions,
  TTMLAgent,
  TTMLPlatformId,
} from "../types";
import { parseTTMLTime } from "../utils/timestamp";

export type { DOMParserConstructor, DOMParserLike };

const NS = {
  TT: "http://www.w3.org/ns/ttml",
  TTM: "http://www.w3.org/ns/ttml#metadata",
  ITUNES: "http://music.apple.com/lyric-ttml-internal",
  AMLL: "http://www.example.com/ns/amll",
  XML: "http://www.w3.org/XML/1998/namespace",
  TTS: "http://www.w3.org/ns/ttml#styling",
} as const;

const Elements = {
  Title: "title",
  Name: "name",
  Meta: "meta",
  ITunesMetadata: "iTunesMetadata",
  Songwriters: "songwriters",
  Songwriter: "songwriter",
  Translation: "translation",
  Translations: "translations",
  Transliteration: "transliteration",
  Transliterations: "transliterations",
  Text: "text",
  Agent: "agent",
  Div: "div",
  P: "p",
  Span: "span",
} as const;

const Attributes = {
  Key: "key",
  Value: "value",
  Lang: "lang",
  Timing: "timing",
  For: "for",
  SongPart: "songPart",
  SongPartKebab: "song-part",
  Begin: "begin",
  End: "end",
  Role: "role",
  Type: "type",
  Ruby: "ruby",
  Obscene: "obscene",
  EmptyBeat: "empty-beat",
  Id: "id",
} as const;

const Values = {
  MusicName: "musicName",
  Artists: "artists",
  Album: "album",
  ISRC: "isrc",
  TTMLAuthorGithub: "ttmlAuthorGithub",
  TTMLAuthorGithubLogin: "ttmlAuthorGithubLogin",
  NCMMusicId: "ncmMusicId",
  QQMusicId: "qqMusicId",
  SpotifyId: "spotifyId",
  AppleMusicId: "appleMusicId",
  RoleBg: "x-bg",
  RoleTranslation: "x-translation",
  RoleRoman: "x-roman",
  Group: "group",
  Person: "person",
  Other: "other",
  RubyContainer: "container",
  RubyBase: "base",
  RubyTextContainer: "textContainer",
  RubyText: "text",
} as const;

const LEADING_SPACE_RE = /^\s/;
const TRAILING_SPACE_RE = /\s$/;
const MULTI_SPACE_RE = /\s+/g;

/**
 * 规范化文本空白字符
 * @param text - 原始文本内容
 * @param trim - 是否去除首尾空白，默认为 true
 * @returns 归一化后的文本
 */
const normalizeText = (text: string | null | undefined, trim = true): string => {
  if (!text) return "";
  const normalized = text.replace(MULTI_SPACE_RE, " ");
  return trim ? normalized.trim() : normalized;
};

/**
 * 剥除文本首尾的全半角括号与空白
 * @param text - 待处理的原始文本
 * @returns 剥除括号后的文本
 */
const stripParens = (text: string): string =>
  text
    .trim()
    .replace(/^[(（]+/, "")
    .replace(/[)）]+$/, "")
    .trim();

/**
 * 规范化 BCP-47 语言代码标签
 * @param lang - 原始语言字符串
 * @returns 小写短横线分隔的规范语言标签
 */
const normalizeLang = (lang: string | null | undefined): string =>
  (lang ?? "").toLowerCase().replace(/_/g, "-");

/**
 * 根据偏好语言从多语言候选列表中挑选最优匹配索引
 * @param langs - 候选语言代码列表
 * @param preferred - 偏好语言代码
 * @returns 最优匹配的索引，无匹配返回 -1
 */
const pickLangIndex = (langs: (string | null)[], preferred: string): number => {
  if (langs.length === 0) return -1;
  const want = normalizeLang(preferred);
  if (!want) return 0;
  const wantBase = want.split("-")[0];
  let baseMatch = -1;
  let hasTagged = false;
  for (let i = 0; i < langs.length; i++) {
    const lang = normalizeLang(langs[i]);
    if (!lang) continue;
    hasTagged = true;
    if (lang === want) return i;
    if (baseMatch === -1 && lang.split("-")[0] === wantBase) baseMatch = i;
  }
  if (baseMatch !== -1) return baseMatch;
  return hasTagged ? -1 : 0;
};

/**
 * 获取 XML 元素的属性值，依次尝试命名空间、回退名称与本地名称
 * @param element - XML DOM 元素
 * @param ns - 属性命名空间 URI
 * @param localName - 属性本地名称
 * @param fallbackAttrName - 可选的回退完整属性名
 * @returns 属性字符串值，不存在返回 null
 */
const getAttr = (
  element: Element,
  ns: string,
  localName: string,
  fallbackAttrName?: string,
): string | null => {
  if (fallbackAttrName) {
    const fallbackVal = element.getAttribute(fallbackAttrName);
    if (fallbackVal !== null) return fallbackVal;
  }
  const direct = element.getAttribute(localName);
  if (direct !== null) return direct;

  const val = element.getAttributeNS(ns, localName);
  if (val !== null) return val;

  const attrs = element.attributes;
  if (attrs) {
    const len = attrs.length;
    for (let i = 0; i < len; i++) {
      const attr = attrs[i];
      const attrLocalName = attr.localName || attr.name.split(":").pop();
      if (attrLocalName === localName) return attr.value;
    }
  }

  return null;
};

/**
 * 字符串数组去重
 * @param arr - 待去重的字符串数组
 * @returns 去重后的字符串数组
 */
const dedupe = (arr?: string[]): string[] => {
  if (!arr || arr.length === 0) return [];
  if (arr.length === 1) return arr;
  return Array.from(new Set(arr));
};

interface SidecarItem {
  lang: string | null;
  text: string;
  words?: LyricWord[];
}

interface SidecarEntry {
  translations?: SidecarItem[];
  romanizations?: SidecarItem[];
  bgTranslations?: SidecarItem[];
  bgRomanizations?: SidecarItem[];
}

type SidecarMap = Record<string, SidecarEntry>;

/**
 * 基于时间重叠交并比将逐字音译音节对齐到主歌词单词上
 * @param mainWords - 主歌词单词数组
 * @param romanWords - 逐字音译音节数组
 * @returns 无返回值（原地修改）
 */
export const alignRomanization = (mainWords: LyricWord[], romanWords: LyricWord[]): void => {
  let romanSearchStartIndex = 0;
  const MIN_IOU_THRESHOLD = 0.1;
  const FAST_TRACK_TOLERANCE_MS = 2;

  for (let i = 0; i < mainWords.length; i++) {
    const main = mainWords[i];
    const mainEndTime = main.endTime;

    let maxIou = 0;
    let bestMatchIndex = -1;
    let isFastTrackMatched = false;

    let j = romanSearchStartIndex;
    while (j < romanWords.length) {
      const sub = romanWords[j];

      if (Math.abs(main.startTime - sub.startTime) <= FAST_TRACK_TOLERANCE_MS) {
        main.romanWord = sub.word;
        romanSearchStartIndex = j + 1;
        isFastTrackMatched = true;
        break;
      }

      const overlapStart = Math.max(main.startTime, sub.startTime);
      const overlapEnd = Math.min(mainEndTime, sub.endTime);
      const intersection = Math.max(0, overlapEnd - overlapStart);

      if (intersection > 0) {
        const unionStart = Math.min(main.startTime, sub.startTime);
        const unionEnd = Math.max(mainEndTime, sub.endTime);
        const unionDuration = Math.max(1, unionEnd - unionStart);

        const iou = intersection / unionDuration;
        if (iou > maxIou) {
          maxIou = iou;
          bestMatchIndex = j;
        }
      }

      if (sub.startTime >= mainEndTime) {
        break;
      }
      j++;
    }

    if (!isFastTrackMatched && bestMatchIndex !== -1 && maxIou >= MIN_IOU_THRESHOLD) {
      main.romanWord = romanWords[bestMatchIndex].word;
      romanSearchStartIndex = bestMatchIndex + 1;
    }
  }
};

/**
 * 解析文档头部元数据与翻译/音译 Sidecar
 * @param doc - XML 文档对象
 * @param detectBackground - 是否剥除背景音括号，默认为 false
 * @returns 包含元数据和 Sidecar 映射的对象
 */
const parseHead = (
  doc: Document,
  detectBackground = false,
): {
  metadata: LyricMetadata;
  sidecar: SidecarMap;
} => {
  const metadata: LyricMetadata = {
    title: [],
    artist: [],
    album: [],
    isrc: [],
    authorIds: [],
    authorNames: [],
    songwriters: [],
    agents: {},
    platformIds: {},
    rawProperties: {},
  };
  const sidecar: SidecarMap = {};

  /**
   * 按照本地标签名查找子元素（忽略 XML 命名空间前缀）
   * @param root - 根元素或文档节点
   * @param targetLocalName - 目标本地标签名
   * @param prefix - 可选的命名空间前缀
   * @returns 匹配的 DOM 元素数组
   */
  const findElementsByLocalName = (
    root: Element | Document,
    targetLocalName: string,
    prefix?: string,
  ): Element[] => {
    const byLocal = root.getElementsByTagName(targetLocalName);
    if (byLocal.length > 0) return Array.from(byLocal);

    if (prefix) {
      const byPrefixed = root.getElementsByTagName(`${prefix}:${targetLocalName}`);
      if (byPrefixed.length > 0) return Array.from(byPrefixed);
    }

    const res: Element[] = [];
    const all = root.getElementsByTagName("*");
    const lower = targetLocalName.toLowerCase();
    const len = all.length;
    for (let i = 0; i < len; i++) {
      const el = all[i];
      const name = el.localName || el.tagName.split(":").pop();
      if (name?.toLowerCase() === lower) {
        res.push(el);
      }
    }
    return res;
  };

  const head =
    doc.getElementsByTagName("head")[0] ||
    findElementsByLocalName(doc as unknown as Element, "head")[0];
  if (!head) return { metadata, sidecar };

  // 标题元数据
  const titles = findElementsByLocalName(head, Elements.Title);
  for (const t of titles) {
    const text = t.textContent?.trim();
    if (text) metadata.title?.push(text);
  }

  // 演唱者与声部
  const agents = findElementsByLocalName(head, Elements.Agent);
  for (const agent of agents) {
    const id = getAttr(agent, NS.XML, Attributes.Id, "xml:id");
    if (!id) continue;
    const type = getAttr(agent, NS.TTM, Attributes.Type, "ttm:type") || "";

    const nameEl = findElementsByLocalName(agent, Elements.Name)[0];
    const name = nameEl?.textContent?.trim() || undefined;

    const agentObj: TTMLAgent = { id, type: type || undefined, name };
    if (!metadata.agents) metadata.agents = {};
    metadata.agents[id] = agentObj;
  }

  // AMLL 扩展元数据
  const metas = findElementsByLocalName(head, Elements.Meta);
  for (const metaEl of metas) {
    const key = getAttr(metaEl, NS.AMLL, Attributes.Key, "amll:key") || metaEl.getAttribute("key");
    const value = (
      getAttr(metaEl, NS.AMLL, Attributes.Value, "amll:value") || metaEl.getAttribute("value")
    )?.trim();
    if (!key || !value) continue;

    switch (key) {
      case Values.MusicName:
        metadata.title?.push(value);
        break;
      case Values.Artists:
        metadata.artist?.push(value);
        break;
      case Values.Album:
        metadata.album?.push(value);
        break;
      case Values.ISRC:
        metadata.isrc?.push(value);
        break;
      case Values.TTMLAuthorGithub:
        metadata.authorIds?.push(value);
        break;
      case Values.TTMLAuthorGithubLogin:
        metadata.authorNames?.push(value);
        break;
      case Values.NCMMusicId:
      case Values.QQMusicId:
      case Values.SpotifyId:
      case Values.AppleMusicId:
        if (!metadata.platformIds) metadata.platformIds = {};
        (metadata.platformIds[key as TTMLPlatformId] ??= []).push(value);
        break;
      default:
        if (!metadata.rawProperties) metadata.rawProperties = {};
        (metadata.rawProperties[key] ??= []).push(value);
        break;
    }
  }

  // 词曲作者、翻译与音译扩展
  const iTunesMetas = findElementsByLocalName(head, Elements.ITunesMetadata);
  const metadataContainers = findElementsByLocalName(head, "metadata");
  const scopeContainers = Array.from(new Set([...iTunesMetas, ...metadataContainers, head]));

  const processedTransContainers = new Set<Element>();
  const processedTranslitContainers = new Set<Element>();
  const processedSongwriterContainers = new Set<Element>();

  for (const container of scopeContainers) {
    const songwritersList = findElementsByLocalName(container, Elements.Songwriters);
    for (const songwritersContainer of songwritersList) {
      if (processedSongwriterContainers.has(songwritersContainer)) continue;
      processedSongwriterContainers.add(songwritersContainer);
      const writers = findElementsByLocalName(songwritersContainer, Elements.Songwriter);
      for (const w of writers) {
        const name = w.textContent?.trim();
        if (name) metadata.songwriters?.push(name);
      }
    }

    /**
     * 解析翻译或音译容器节点并归纳进 Sidecar 映射
     * @param containerName - 外层容器标签名
     * @param itemName - 内部条目标签名
     * @param type - 条目类型（translations 或 romanizations）
     * @param processedSet - 已处理元素集合（用于去重）
     * @returns 无返回值
     */
    const processEntries = (
      containerName: string,
      itemName: string,
      type: "translations" | "romanizations",
      processedSet: Set<Element>,
    ): void => {
      const containers = findElementsByLocalName(container, containerName);
      for (const c of containers) {
        if (processedSet.has(c)) continue;
        processedSet.add(c);
        const items = findElementsByLocalName(c, itemName);
        for (const item of items) {
          const lang = getAttr(item, NS.XML, Attributes.Lang, "xml:lang");
          const textNodes = findElementsByLocalName(item, Elements.Text);
          for (const textNode of textNodes) {
            const forId = textNode.getAttribute(Attributes.For);
            if (!forId) continue;

            let mainText = "";
            let bgText = "";
            const mainWords: LyricWord[] = [];
            const bgWords: LyricWord[] = [];

            for (const node of Array.from(textNode.childNodes)) {
              if (node.nodeType === 3) {
                mainText += node.textContent ?? "";
              } else if (node.nodeType === 1) {
                const childEl = node as Element;
                const isBg =
                  getAttr(childEl, NS.TTM, Attributes.Role, "ttm:role") === Values.RoleBg;
                const raw = childEl.textContent ?? "";
                const normalized = normalizeText(raw, false);
                const clean = normalized.trim();
                const b = getAttr(childEl, NS.XML, Attributes.Begin);
                const e = getAttr(childEl, NS.XML, Attributes.End);
                const endsWithSpace = TRAILING_SPACE_RE.test(normalized);

                if (isBg) {
                  bgText += raw;
                  const innerSpans = childEl.getElementsByTagName("span");
                  if (innerSpans.length > 0) {
                    for (let s = 0; s < innerSpans.length; s++) {
                      const sp = innerSpans[s];
                      const spB = getAttr(sp, NS.XML, Attributes.Begin);
                      const spE = getAttr(sp, NS.XML, Attributes.End);
                      const spClean = stripParens(normalizeText(sp.textContent ?? ""));
                      if (spB && spE && spClean) {
                        bgWords.push({
                          word: spClean,
                          startTime: parseTTMLTime(spB),
                          endTime: parseTTMLTime(spE),
                        });
                      }
                    }
                  } else if (b && e && clean) {
                    bgWords.push({
                      word: stripParens(clean),
                      startTime: parseTTMLTime(b),
                      endTime: parseTTMLTime(e),
                      endsWithSpace: endsWithSpace || undefined,
                    });
                  }
                } else {
                  mainText += raw;
                  if (b && e && clean) {
                    mainWords.push({
                      word: clean,
                      startTime: parseTTMLTime(b),
                      endTime: parseTTMLTime(e),
                      endsWithSpace: endsWithSpace || undefined,
                    });
                  }
                }
              }
            }

            mainText = normalizeText(mainText);
            const normalizedBg = normalizeText(bgText);
            bgText = detectBackground ? stripParens(normalizedBg) : normalizedBg;
            if (!mainText && !bgText) continue;

            if (!sidecar[forId]) sidecar[forId] = {};
            if (mainText) {
              (sidecar[forId][type] ??= []).push({
                lang,
                text: mainText,
                words: mainWords.length > 0 ? mainWords : undefined,
              });
            }
            if (bgText) {
              const bgType = type === "translations" ? "bgTranslations" : "bgRomanizations";
              (sidecar[forId][bgType] ??= []).push({
                lang,
                text: bgText,
                words: bgWords.length > 0 ? bgWords : undefined,
              });
            }
          }
        }
      }
    };

    processEntries(
      Elements.Translations,
      Elements.Translation,
      "translations",
      processedTransContainers,
    );
    processEntries(
      Elements.Transliterations,
      Elements.Transliteration,
      "romanizations",
      processedTranslitContainers,
    );
  }

  // 去重
  metadata.title = dedupe(metadata.title);
  metadata.artist = dedupe(metadata.artist);
  metadata.album = dedupe(metadata.album);
  metadata.isrc = dedupe(metadata.isrc);
  metadata.authorIds = dedupe(metadata.authorIds);
  metadata.authorNames = dedupe(metadata.authorNames);
  metadata.songwriters = dedupe(metadata.songwriters);

  return { metadata, sidecar };
};

interface ParsedParagraphState {
  fullText: string;
  words: LyricWord[];
  translations: Array<{ lang: string | null; text: string }>;
  romanizations: Array<{ lang: string | null; text: string }>;
  bgLines: LyricLine[];
}

/**
 * 解析并创建可用的 DOMParser 实例
 * @param options - TTML 解析配置选项
 * @returns DOMParser 实例
 */
const resolveDomParser = (options?: ParseOptions): DOMParserLike => {
  if (options?.domParser) {
    if (typeof options.domParser === "function") {
      const Ctor = options.domParser as DOMParserConstructor;
      return new Ctor();
    }
    return options.domParser;
  }
  if (typeof DOMParser !== "undefined") {
    return new DOMParser();
  }
  throw new Error(
    "DOMParser is not available in current environment. Please pass a domParser in options.",
  );
};

/**
 * 解析 TTML 格式歌词文本
 * @param text - 符合 TTML 规范的 XML 歌词字符串
 * @param options - 解析配置选项
 * @returns 歌词解析结果
 */
export const parseTTML = (text: string, options?: ParseOptions): LyricResult => {
  const detectBackground = options?.detectBackground ?? false;
  const extractMetadata = options?.extractMetadata ?? false;
  const preferredLang = options?.preferredLang ?? "";
  const parser = resolveDomParser(options);
  const doc = parser.parseFromString(text, "application/xml");

  if (doc.querySelector?.("parsererror") || doc.getElementsByTagName("parsererror")[0]) {
    throw new Error("Invalid TTML XML");
  }

  const { metadata, sidecar } = parseHead(doc, detectBackground);

  const root = doc.documentElement;
  if (root) {
    const lang = getAttr(root, NS.XML, Attributes.Lang, "xml:lang");
    if (lang) {
      metadata.language = lang;
    }
    const timing =
      getAttr(root, NS.ITUNES, Attributes.Timing, "itunes:timing") ||
      getAttr(root, "", Attributes.Timing);
    if (timing === "Word" || timing === "Line") {
      metadata.timingMode = timing;
    }
  }

  const resultLines: LyricLine[] = [];

  let currentBlockIndex = 0;

  /**
   * 递归解析段落或背景音节点的内容、逐字时间戳与内嵌角色
   * @param element - 当前 DOM 元素
   * @param parentKey - 父级节点的 key 标识
   * @param isBG - 是否作为背景音解析，默认 false
   * @returns 解析后的段落状态（包含文本、单词、翻译与音译）
   */
  const parseCommonContent = (
    element: Element,
    parentKey: string | null,
    isBG = false,
  ): ParsedParagraphState => {
    const state: ParsedParagraphState = {
      fullText: "",
      words: [],
      translations: [],
      romanizations: [],
      bgLines: [],
    };

    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === 3) {
        const rawText = node.textContent || "";
        const isFormatting = rawText.includes("\n");
        if (isFormatting && rawText.trim().length === 0) continue;

        const normalizedWText = normalizeText(rawText, false);
        state.fullText += normalizedWText;

        if (!isFormatting && normalizedWText.length > 0 && normalizedWText.trim().length === 0) {
          if (state.words.length > 0) {
            state.words[state.words.length - 1].endsWithSpace = true;
          }
        }
      } else if (node.nodeType === 1) {
        const el = node as Element;
        const role = getAttr(el, NS.TTM, Attributes.Role, "ttm:role");
        const rubyAttr = getAttr(el, NS.TTS, Attributes.Ruby, "tts:ruby");

        if (rubyAttr === Values.RubyContainer) {
          const obsceneAttr = getAttr(el, NS.AMLL, Attributes.Obscene, "amll:obscene");
          const isObscene = obsceneAttr === "true";

          const emptyBeatAttr = getAttr(el, NS.AMLL, Attributes.EmptyBeat, "amll:empty-beat");
          const emptyBeat = emptyBeatAttr ? parseInt(emptyBeatAttr, 10) : undefined;

          let baseText = "";
          const rubyTags: Array<{ word: string; startTime: number; endTime: number }> = [];

          for (const childNode of Array.from(el.childNodes)) {
            if (childNode.nodeType !== 1) continue;
            const childEl = childNode as Element;
            const childRubyAttr = getAttr(childEl, NS.TTS, Attributes.Ruby, "tts:ruby");

            if (childRubyAttr === Values.RubyBase) {
              baseText = normalizeText(childEl.textContent, false);
            } else if (childRubyAttr === Values.RubyTextContainer) {
              for (const textNode of Array.from(childEl.childNodes)) {
                if (textNode.nodeType !== 1) continue;
                const tNode = textNode as Element;
                const tAttr = getAttr(tNode, NS.TTS, Attributes.Ruby, "tts:ruby");
                if (tAttr === Values.RubyText) {
                  const begin = getAttr(tNode, NS.XML, Attributes.Begin);
                  const end = getAttr(tNode, NS.XML, Attributes.End);
                  const rubyWord = normalizeText(tNode.textContent, false).trim();
                  if (rubyWord && begin && end) {
                    rubyTags.push({
                      word: rubyWord,
                      startTime: parseTTMLTime(begin),
                      endTime: parseTTMLTime(end),
                    });
                  }
                }
              }
            }
          }

          if (baseText) {
            state.fullText += baseText;
            let startTime = 0;
            let endTime = 0;
            if (rubyTags.length > 0) {
              startTime = Math.min(...rubyTags.map((t) => t.startTime));
              endTime = Math.max(...rubyTags.map((t) => t.endTime));
            }

            const cleanBaseText = baseText.trim();
            if (cleanBaseText.length > 0) {
              const endsWithSpace = TRAILING_SPACE_RE.test(baseText);
              const startsWithSpace = LEADING_SPACE_RE.test(baseText);

              if (startsWithSpace && state.words.length > 0) {
                state.words[state.words.length - 1].endsWithSpace = true;
              }

              state.words.push({
                word: cleanBaseText,
                startTime,
                endTime,
                ruby: rubyTags.length > 0 ? rubyTags : undefined,
                endsWithSpace: endsWithSpace || undefined,
                obscene: isObscene ? true : undefined,
                emptyBeat,
              });
            }
          }
        } else if (role === Values.RoleBg && !isBG) {
          // 背景歌词（role="x-bg"）
          const bgBegin = getAttr(el, NS.XML, Attributes.Begin);
          const bgEnd = getAttr(el, NS.XML, Attributes.End);
          const bgState = parseCommonContent(el, parentKey, true);

          let bgStart = bgBegin ? parseTTMLTime(bgBegin) : 0;
          let bgEndMs = bgEnd ? parseTTMLTime(bgEnd) : 0;
          if ((!bgStart || !bgEndMs) && bgState.words.length > 0) {
            bgStart = Math.min(...bgState.words.map((w) => w.startTime));
            bgEndMs = Math.max(...bgState.words.map((w) => w.endTime));
          }

          // 背景音自身无时间时继承父级时间
          if (!bgStart) {
            const pBegin = getAttr(element, NS.XML, Attributes.Begin);
            if (pBegin) bgStart = parseTTMLTime(pBegin);
          }
          if (!bgEndMs) {
            const pEnd = getAttr(element, NS.XML, Attributes.End);
            if (pEnd) bgEndMs = parseTTMLTime(pEnd);
          }

          // 仅在显式开启 detectBackground 时剥除背景音首尾括号
          if (detectBackground) {
            if (bgState.words.length > 0) {
              const first = bgState.words[0];
              first.word = first.word.replace(/^[(（]+/, "").trimStart();
              if (!first.word) bgState.words.shift();

              if (bgState.words.length > 0) {
                const last = bgState.words[bgState.words.length - 1];
                last.word = last.word.replace(/[)）]+$/, "").trimEnd();
                if (!last.word) bgState.words.pop();
              }
            }
          }

          // 若背景音无逐字 span，回退为单词行
          const cleanBgText = detectBackground
            ? stripParens(bgState.fullText)
            : bgState.fullText.trim();
          if (bgState.words.length === 0 && cleanBgText) {
            bgState.words.push({
              word: cleanBgText,
              startTime: bgStart,
              endTime: bgEndMs,
            });
          }

          let trans = "";
          let roman = "";
          let selectedBgRomanWords: LyricWord[] | undefined;

          if (parentKey && sidecar[parentKey]) {
            const sc = sidecar[parentKey];
            if (sc.bgTranslations?.length) {
              const idx = pickLangIndex(
                sc.bgTranslations.map((t) => t.lang),
                preferredLang,
              );
              if (idx !== -1) trans = sc.bgTranslations[idx].text;
            }
            if (sc.bgRomanizations?.length) {
              roman = sc.bgRomanizations[0].text;
              selectedBgRomanWords = sc.bgRomanizations[0].words;
            }
          }

          // 回退到背景行内翻译/音译
          if (!trans && bgState.translations.length > 0) {
            const idx = pickLangIndex(
              bgState.translations.map((t) => t.lang),
              preferredLang,
            );
            if (idx !== -1) trans = bgState.translations[idx].text;
          }
          if (!roman && bgState.romanizations.length > 0) {
            roman = bgState.romanizations[0].text;
          }

          if (selectedBgRomanWords && bgState.words.length > 0) {
            alignRomanization(bgState.words, selectedBgRomanWords);
          }

          const bgAgent = getAttr(el, NS.TTM, Elements.Agent, "ttm:agent");

          state.bgLines.push({
            words: bgState.words,
            translatedLyric: trans,
            romanLyric: roman,
            startTime: bgStart,
            endTime: bgEndMs,
            isBG: true,
            isDuet: false,
            agentId: bgAgent || undefined,
          });
        } else if (role === Values.RoleTranslation) {
          const lang = getAttr(el, NS.XML, Attributes.Lang, "xml:lang");
          const t = normalizeText(el.textContent);
          if (t) state.translations.push({ lang, text: t });
        } else if (role === Values.RoleRoman) {
          const lang = getAttr(el, NS.XML, Attributes.Lang, "xml:lang");
          const r = normalizeText(el.textContent);
          if (r) state.romanizations.push({ lang, text: r });
        } else {
          const wBegin = getAttr(el, NS.XML, Attributes.Begin);
          const wEnd = getAttr(el, NS.XML, Attributes.End);

          const obsceneAttr = getAttr(el, NS.AMLL, Attributes.Obscene, "amll:obscene");
          const isObscene = obsceneAttr === "true";

          const emptyBeatAttr = getAttr(el, NS.AMLL, Attributes.EmptyBeat, "amll:empty-beat");
          const emptyBeat = emptyBeatAttr ? parseInt(emptyBeatAttr, 10) : undefined;

          const rawWText = el.textContent || "";
          const normalizedWText = normalizeText(rawWText, false);
          state.fullText += normalizedWText;

          if (wBegin && wEnd) {
            const isFormatting = rawWText.includes("\n");
            let startsWithSpace = false;
            let endsWithSpace = false;

            if (!isFormatting) {
              startsWithSpace = LEADING_SPACE_RE.test(normalizedWText);
              endsWithSpace = TRAILING_SPACE_RE.test(normalizedWText);
            }

            const cleanText = normalizedWText.trim();
            if (startsWithSpace && state.words.length > 0) {
              state.words[state.words.length - 1].endsWithSpace = true;
            }

            if (cleanText.length > 0) {
              state.words.push({
                word: cleanText,
                startTime: parseTTMLTime(wBegin),
                endTime: parseTTMLTime(wEnd),
                endsWithSpace: endsWithSpace || undefined,
                obscene: isObscene ? true : undefined,
                emptyBeat,
              });
            }
          }
        }
      }
    }

    if (state.words.length > 0) {
      state.words[0].word = state.words[0].word.trimStart();
      const last = state.words[state.words.length - 1];
      last.word = last.word.trimEnd();
      delete last.endsWithSpace;
    }

    return state;
  };

  let lastPersonAgentId: string | null = null;
  let lastPersonIsDuet = false;

  /**
   * 确定当前演唱者是否属于对唱侧
   * @param agentId - 演唱者标识符
   * @returns 是否属于对唱声部
   */
  const determineDuet = (agentId: string | undefined): boolean => {
    const aid = agentId || "v1";
    const agent = metadata.agents?.[aid];
    const isGroup = agent?.type === Values.Group;
    const isOther = agent?.type === Values.Other;

    if (isGroup) {
      return false;
    }

    if (lastPersonAgentId === null) {
      const current = !!isOther;
      lastPersonAgentId = aid;
      lastPersonIsDuet = current;
      return current;
    }

    if (lastPersonAgentId === aid) {
      return lastPersonIsDuet;
    }

    const current = !lastPersonIsDuet;
    lastPersonAgentId = aid;
    lastPersonIsDuet = current;
    return current;
  };

  /**
   * 解析单个歌词行元素（<p>）并追加至结果列表
   * @param p - 段落 DOM 元素
   * @param songPart - 所属歌曲分段名称
   * @param blockIdx - 所属段落区块序号
   * @returns 无返回值
   */
  const processLineElement = (p: Element, songPart?: string, blockIdx?: number): void => {
    const begin = getAttr(p, NS.XML, Attributes.Begin);
    const end = getAttr(p, NS.XML, Attributes.End);
    const lineAgent = getAttr(p, NS.TTM, Elements.Agent, "ttm:agent");
    const key = getAttr(p, NS.ITUNES, Attributes.Key, "itunes:key") || p.getAttribute("id");

    const state = parseCommonContent(p, key, false);

    let startTime = begin ? parseTTMLTime(begin) : 0;
    let endTime = end ? parseTTMLTime(end) : 0;

    if ((!startTime || !endTime) && state.words.length > 0) {
      startTime = Math.min(...state.words.map((w) => w.startTime));
      endTime = Math.max(...state.words.map((w) => w.endTime));
    }

    // 逐行翻译与音译决策
    let translatedLyric = "";
    let romanLyric = "";
    let selectedRomanWords: LyricWord[] | undefined;

    // 优先从 sidecar 获取
    if (key && sidecar[key]) {
      const sc = sidecar[key];
      if (sc.translations?.length) {
        const idx = pickLangIndex(
          sc.translations.map((t) => t.lang),
          preferredLang,
        );
        if (idx !== -1) translatedLyric = sc.translations[idx].text;
      }
      if (sc.romanizations?.length) {
        romanLyric = sc.romanizations[0].text;
        selectedRomanWords = sc.romanizations[0].words;
      }
    }

    // 回退到行内翻译与音译
    if (!translatedLyric && state.translations.length > 0) {
      const idx = pickLangIndex(
        state.translations.map((t) => t.lang),
        preferredLang,
      );
      if (idx !== -1) translatedLyric = state.translations[idx].text;
    }
    if (!romanLyric && state.romanizations.length > 0) {
      romanLyric = state.romanizations[0].text;
    }

    if (selectedRomanWords && state.words.length > 0) {
      alignRomanization(state.words, selectedRomanWords);
    }

    // 对唱判定
    const isDuet = determineDuet(lineAgent || undefined);

    // 回退单字行
    if (state.words.length === 0 && state.fullText.trim().length > 0) {
      state.words.push({
        word: state.fullText.trim(),
        startTime,
        endTime,
      });
    }

    const mainLine: LyricLine = {
      id: key || undefined,
      words: state.words,
      translatedLyric,
      romanLyric,
      startTime,
      endTime,
      isBG: false,
      isDuet,
      agentId: lineAgent || undefined,
      songPart: songPart || undefined,
      blockIndex: blockIdx,
    };

    resultLines.push(mainLine);
    if (state.bgLines.length > 0) {
      for (const bg of state.bgLines) {
        bg.isDuet = isDuet;
      }
      resultLines.push(...state.bgLines);
    }
  };

  const body = doc.getElementsByTagName("body")[0];
  if (body) {
    for (const node of Array.from(body.childNodes)) {
      if (node.nodeType !== 1) continue;
      const el = node as Element;
      const tagName = el.localName || el.tagName.toLowerCase().split(":").pop();

      if (tagName === Elements.Div) {
        currentBlockIndex++;
        const songPart =
          getAttr(el, NS.ITUNES, Attributes.SongPartKebab, "itunes:song-part") ||
          getAttr(el, NS.ITUNES, Attributes.SongPart, "itunes:songPart") ||
          undefined;

        const pNodes = Array.from(el.getElementsByTagName("p"));
        for (const p of pNodes) {
          processLineElement(p, songPart, currentBlockIndex);
        }
      } else if (tagName === Elements.P) {
        currentBlockIndex++;
        processLineElement(el, undefined, currentBlockIndex);
      }
    }
  }

  if (!metadata.timingMode) {
    const hasWordTiming = resultLines.some((l) => (l.words?.length ?? 0) > 1);
    metadata.timingMode = hasWordTiming ? "Word" : "Line";
  }

  return {
    lines: resultLines,
    metadata: extractMetadata ? metadata : {},
  };
};
