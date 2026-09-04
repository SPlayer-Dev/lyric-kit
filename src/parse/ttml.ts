import type { LyricLine, LyricWord } from "../types";
import { parseTTMLTime } from "../utils/timestamp";

interface DOMParserLike {
  parseFromString: (text: string, type: string) => Document;
}

type DOMParserConstructor = new () => DOMParserLike;

export interface ParseTTMLOptions {
  preferredLang?: string;
  domParser?: DOMParserLike | DOMParserConstructor;
}

/**
 * 获取元素属性值，兼容命名空间前缀（如 ttm:agent → agent）
 */
const getAttr = (el: Element, name: string): string | null => {
  const direct = el.getAttribute(name);
  if (direct !== null) return direct;
  for (const attr of Array.from(el.attributes)) {
    if (attr.localName === name || attr.name.endsWith(`:${name}`)) {
      return attr.value;
    }
  }
  return null;
};

/**
 * 递归提取 span 中的纯文本，跳过翻译和音译子 span
 */
const getWordText = (el: Element): string => {
  let text = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) {
      // Node.TEXT_NODE === 3
      text += node.textContent ?? "";
    } else if (node.nodeType === 1) {
      // Node.ELEMENT_NODE === 1
      const role = getAttr(node as Element, "role");
      if (role !== "x-translation" && role !== "x-roman") {
        text += getWordText(node as Element);
      }
    }
  }
  return text;
};

/**
 * 收集所有演唱者 agent：建立 id→type 映射，并取第一个 type="person" 的 agent 作为主唱
 */
const collectAgents = (doc: Document): { mainAgent: string; agentTypes: Map<string, string> } => {
  const agentTypes = new Map<string, string>();
  let mainAgent = "";
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    if (el.localName !== "agent") continue;
    const id = el.getAttribute("xml:id") || getAttr(el, "id");
    if (!id) continue;
    const type = el.getAttribute("type") || "";
    agentTypes.set(id, type);
    if (!mainAgent && type === "person") mainAgent = id;
  }
  return { mainAgent: mainAgent || "v1", agentTypes };
};

const stripParens = (text: string): string =>
  text
    .trim()
    .replace(/^[（(]/, "")
    .replace(/[)）]$/, "")
    .trim();

const normalizeLang = (lang: string | null | undefined): string =>
  (lang ?? "").toLowerCase().replace(/_/g, "-");

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

interface TransCandidate {
  lang: string | null;
  main: string;
  bg: string;
}

/**
 * 收集 iTunes 翻译元数据（translations 段中的 text[for] 元素）
 */
const collectTranslations = (
  doc: Document,
  preferredLang: string,
): Map<string, { main: string; bg: string }> => {
  const candidates = new Map<string, TransCandidate[]>();

  for (const textEl of Array.from(doc.querySelectorAll("text[for]"))) {
    const parent = textEl.parentElement;
    if (!parent || (parent.localName !== "translation" && !parent.closest("translations"))) {
      continue;
    }

    const key = textEl.getAttribute("for");
    if (!key) continue;

    let main = "";
    let bg = "";
    for (const node of Array.from(textEl.childNodes)) {
      if (node.nodeType === 3) {
        main += node.textContent ?? "";
      } else if (node.nodeType === 1) {
        const childEl = node as Element;
        if (getAttr(childEl, "role") === "x-bg") {
          bg += childEl.textContent ?? "";
        } else {
          main += childEl.textContent ?? "";
        }
      }
    }

    main = main.trim();
    bg = stripParens(bg);
    if (!main && !bg) continue;

    const lang = getAttr(parent, "lang");
    const list = candidates.get(key) ?? [];
    list.push({ lang, main, bg });
    candidates.set(key, list);
  }

  const translations = new Map<string, { main: string; bg: string }>();
  for (const [key, list] of candidates) {
    const idx = pickLangIndex(
      list.map((item) => item.lang),
      preferredLang,
    );
    if (idx !== -1) translations.set(key, { main: list[idx].main, bg: list[idx].bg });
  }

  return translations;
};

interface RomanWord {
  startTime: number;
  endTime: number;
  text: string;
}

interface TransliterationMaps {
  lines: Map<string, { main: string; bg: string }>;
  words: Map<string, { main: RomanWord[]; bg: RomanWord[] }>;
}

/**
 * 收集 iTunes 音译元数据（transliterations 段中的 text[for] 元素）
 */
const collectTransliterations = (doc: Document): TransliterationMaps => {
  const lines = new Map<string, { main: string; bg: string }>();
  const words = new Map<string, { main: RomanWord[]; bg: RomanWord[] }>();

  for (const textEl of Array.from(doc.querySelectorAll("text[for]"))) {
    const parent = textEl.parentElement;
    if (
      !parent ||
      (parent.localName !== "transliteration" && !parent.closest("transliterations"))
    ) {
      continue;
    }

    const key = textEl.getAttribute("for");
    if (!key) continue;

    const mainWords: RomanWord[] = [];
    const bgWords: RomanWord[] = [];
    let lineMain = "";
    let lineBg = "";

    for (const node of Array.from(textEl.childNodes)) {
      if (node.nodeType === 3) {
        lineMain += node.textContent ?? "";
      } else if (node.nodeType === 1) {
        const childEl = node as Element;
        if (getAttr(childEl, "role") === "x-bg") {
          const timedSpans = Array.from(childEl.querySelectorAll("span[begin][end]"));
          if (timedSpans.length > 0) {
            for (const span of timedSpans) {
              bgWords.push({
                startTime: parseTTMLTime(span.getAttribute("begin") ?? ""),
                endTime: parseTTMLTime(span.getAttribute("end") ?? ""),
                text: stripParens(span.textContent ?? ""),
              });
            }
          } else {
            lineBg += childEl.textContent ?? "";
          }
        } else if (childEl.hasAttribute("begin") && childEl.hasAttribute("end")) {
          mainWords.push({
            startTime: parseTTMLTime(childEl.getAttribute("begin") ?? ""),
            endTime: parseTTMLTime(childEl.getAttribute("end") ?? ""),
            text: childEl.textContent ?? "",
          });
        }
      }
    }

    if (mainWords.length > 0 || bgWords.length > 0) {
      words.set(key, { main: mainWords, bg: bgWords });
    }

    lineMain = lineMain.trim();
    lineBg = stripParens(lineBg);
    if (lineMain || lineBg) lines.set(key, { main: lineMain, bg: lineBg });
  }

  return { lines, words };
};

/**
 * 逐词音译对齐
 */
const alignRomanWords = (words: LyricWord[], romanWords: RomanWord[]): void => {
  if (words.length === 0 || romanWords.length === 0) return;
  const FAST_TRACK_TOLERANCE_MS = 2;
  const MIN_IOU = 0.1;
  let searchStart = 0;
  for (const word of words) {
    let bestIou = 0;
    let bestIdx = -1;
    let fastMatched = false;
    for (let idx = searchStart; idx < romanWords.length; idx++) {
      const roman = romanWords[idx];
      if (Math.abs(word.startTime - roman.startTime) <= FAST_TRACK_TOLERANCE_MS) {
        word.romanWord = roman.text;
        searchStart = idx + 1;
        fastMatched = true;
        break;
      }
      const overlapStart = Math.max(word.startTime, roman.startTime);
      const intersection = Math.max(0, Math.min(word.endTime, roman.endTime) - overlapStart);
      if (intersection > 0) {
        const unionStart = Math.min(word.startTime, roman.startTime);
        const union = Math.max(1, Math.max(word.endTime, roman.endTime) - unionStart);
        const iou = intersection / union;
        if (iou > bestIou) {
          bestIou = iou;
          bestIdx = idx;
        }
      }
      if (roman.startTime >= word.endTime) break;
    }
    if (!fastMatched && bestIdx !== -1 && bestIou >= MIN_IOU) {
      word.romanWord = romanWords[bestIdx].text;
      searchStart = bestIdx + 1;
    }
  }
};

const resolveDomParser = (options?: ParseTTMLOptions): DOMParserLike => {
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
    "DOMParser is not available in the current runtime environment. Please supply a domParser in options.",
  );
};

/**
 * 解析 TTML（Apple Music / AMLL）歌词文本
 * 支持逐字时间戳、对唱区分、背景歌词、iTunes 多语言翻译与音译对齐
 *
 * @param text TTML XML 文本内容
 * @param preferredLangOrOptions 偏好语言（如 "zh-CN"）或配置对象
 * @returns 解析后的歌词行数组
 */
export const parseTTML = (
  text: string,
  preferredLangOrOptions?: string | ParseTTMLOptions,
): LyricLine[] => {
  const options: ParseTTMLOptions =
    typeof preferredLangOrOptions === "string"
      ? { preferredLang: preferredLangOrOptions }
      : (preferredLangOrOptions ?? {});

  const preferredLang = options.preferredLang ?? "";
  const parser = resolveDomParser(options);
  const doc = parser.parseFromString(text, "application/xml");

  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid TTML XML");
  }

  const { mainAgent, agentTypes } = collectAgents(doc);
  const translations = collectTranslations(doc, preferredLang);
  const transliterations = collectTransliterations(doc);
  const lines: LyricLine[] = [];

  const parseParagraph = (
    el: Element,
    isBG: boolean,
    isDuet: boolean,
    parentKey: string | null,
  ): void => {
    const begin = getAttr(el, "begin");
    const end = getAttr(el, "end");
    const lineAgent = getAttr(el, "agent");

    const line: LyricLine = {
      words: [],
      translatedLyric: "",
      romanLyric: "",
      isBG,
      isDuet: isBG
        ? isDuet
        : !!lineAgent && lineAgent !== mainAgent && agentTypes.get(lineAgent) !== "group",
      startTime: begin ? parseTTMLTime(begin) : 0,
      endTime: end ? parseTTMLTime(end) : 0,
    };

    const itunesKey = isBG ? parentKey : getAttr(el, "key");
    if (itunesKey) {
      const trans = translations.get(itunesKey);
      if (trans) line.translatedLyric = isBG ? trans.bg : trans.main;
      const lineRoman = transliterations.lines.get(itunesKey);
      if (lineRoman) line.romanLyric = isBG ? lineRoman.bg : lineRoman.main;
    }

    const romanWordData = itunesKey ? transliterations.words.get(itunesKey) : undefined;
    const availableRomanWords = romanWordData
      ? [...(isBG ? romanWordData.bg : romanWordData.main)]
      : [];
    const timedWords: LyricWord[] = [];

    let bgCount = 0;
    let lastWasTimedSpan = false;
    const transCandidates: { lang: string | null; text: string }[] = [];

    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) {
        const word = node.textContent ?? "";
        if (word.trim()) {
          line.words.push({ word, startTime: line.startTime, endTime: line.endTime });
          lastWasTimedSpan = false;
        } else if (
          lastWasTimedSpan &&
          word.includes(" ") &&
          !word.includes("\n") &&
          !word.includes("\r")
        ) {
          const lastWord = line.words[line.words.length - 1];
          line.words.push({
            word: " ",
            startTime: lastWord?.endTime ?? line.startTime,
            endTime: lastWord?.endTime ?? line.startTime,
          });
        }
      } else if (node.nodeType === 1) {
        const span = node as Element;
        if (span.localName !== "span") continue;
        const role = getAttr(span, "role");

        if (role === "x-bg") {
          parseParagraph(span, true, line.isDuet, itunesKey);
          bgCount++;
        } else if (role === "x-translation") {
          transCandidates.push({
            lang: getAttr(span, "lang"),
            text: span.textContent?.trim() ?? "",
          });
        } else if (role === "x-roman") {
          if (!line.romanLyric) line.romanLyric = span.textContent?.trim() ?? "";
        } else {
          const wb = getAttr(span, "begin");
          const we = getAttr(span, "end");
          if (wb && we) {
            const lyricWord: LyricWord = {
              word: getWordText(span),
              startTime: parseTTMLTime(wb),
              endTime: parseTTMLTime(we),
            };
            line.words.push(lyricWord);
            timedWords.push(lyricWord);
            lastWasTimedSpan = true;
          }
        }
      }
    }

    alignRomanWords(timedWords, availableRomanWords);

    if (!line.translatedLyric) {
      const valid = transCandidates.filter((item) => item.text);
      const idx = pickLangIndex(
        valid.map((item) => item.lang),
        preferredLang,
      );
      if (idx !== -1) line.translatedLyric = valid[idx].text;
    }

    if (!begin || !end) {
      const timed = line.words.filter((w) => w.word.trim());
      if (timed.length) {
        line.startTime = Math.min(...timed.map((w) => w.startTime));
        line.endTime = Math.max(...timed.map((w) => w.endTime));
      }
    }

    if (isBG && line.words.length) {
      const first = line.words[0];
      if (/^[（(]/.test(first.word)) {
        first.word = first.word.replace(/^[（(]/, "");
        if (!first.word) line.words.shift();
      }
      const last = line.words[line.words.length - 1];
      if (last && /[)）]$/.test(last.word)) {
        last.word = last.word.replace(/[)）]$/, "");
        if (!last.word) line.words.pop();
      }
    }

    if (bgCount > 0) {
      const bgLines = lines.splice(lines.length - bgCount, bgCount);
      lines.push(line, ...bgLines);
    } else {
      lines.push(line);
    }
  };

  for (const p of Array.from(doc.querySelectorAll("p"))) {
    if (getAttr(p, "begin") && getAttr(p, "end")) {
      parseParagraph(p, false, false, null);
    }
  }

  return lines;
};
