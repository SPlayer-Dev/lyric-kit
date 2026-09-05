import { normalizeKangxi } from "../clean/kangxi";
import type { LyricLine, LyricMetadata, LyricResult, LyricWord, ParseOptions } from "../types";
import { detectBackgroundLine, splitTrailingBackground } from "../utils/bg";

/** 行头：[起始毫秒, 时长毫秒] */
const LINE_HEADER_RE = /^\[(\d+),(\d+)\]/;

/** 匹配元数据标签（如 [ti:xxx]、[ar:xxx]） */
const META_TAG_RE = /^\[([a-zA-Z]+):(.*?)]$/;

/** 逐词匹配正则：词内容(起始毫秒,时长毫秒) */
const WORD_RE = /(.*?)\((\d+),(\d+)\)/g;

/**
 * 逐词解析单行 QRC 字级歌词与时间戳
 * @param rest - 行头时间戳之后的行文本内容
 * @returns 解析出的歌词单词列表
 */
const parseWords = (rest: string): LyricWord[] => {
  const words: LyricWord[] = [];
  WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WORD_RE.exec(rest)) !== null) {
    const rawWord = match[1];
    const start = parseInt(match[2], 10);
    const dur = parseInt(match[3], 10);

    if (!rawWord && dur === 0) continue;

    const startsWithSpace = /^\s/.test(rawWord);
    const endsWithSpace = /\s$/.test(rawWord);
    const cleanWord = rawWord.trim();

    if (startsWithSpace && words.length > 0) {
      words[words.length - 1].endsWithSpace = true;
    }

    if (cleanWord) {
      words.push({
        word: cleanWord,
        startTime: start,
        endTime: start + dur,
        endsWithSpace: endsWithSpace || undefined,
      });
    }
  }

  if (words.length > 0) {
    delete words[words.length - 1].endsWithSpace;
  }

  return words;
};

/** XML 字符实体反转义 */
const decodeXmlEntities = (str: string): string =>
  str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/**
 * 从 XML 包裹结构中提取 QRC 纯文本歌词内容与元数据
 * @param text - 原始 QRC 文本（可能包含 XML 标签）
 * @returns 提取出的纯文本歌词与元数据对象
 */
const extractFromXml = (text: string): { content: string; xmlMeta?: LyricMetadata } => {
  if (!text.trimStart().startsWith("<")) return { content: text };

  let xmlMeta: LyricMetadata | undefined;
  const titleMatch = text.match(/(?:Title|musicName)="([^"]+)"/i);
  const singerMatch = text.match(/(?:Singer|Artist|artists)="([^"]+)"/i);
  const albumMatch = text.match(/(?:Album)="([^"]+)"/i);

  if (titleMatch || singerMatch || albumMatch) {
    xmlMeta = {};
    if (titleMatch) xmlMeta.title = [decodeXmlEntities(titleMatch[1])];
    if (singerMatch) xmlMeta.artist = [decodeXmlEntities(singerMatch[1])];
    if (albumMatch) xmlMeta.album = [decodeXmlEntities(albumMatch[1])];
  }

  const greedyMatch = text.match(/LyricContent="([\s\S]*)"\s*\/?>/);
  if (greedyMatch) return { content: decodeXmlEntities(greedyMatch[1]), xmlMeta };
  const cdataMatch = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdataMatch) return { content: cdataMatch[1], xmlMeta };
  const attrMatch = text.match(/LyricContent="([^"]*)"/);
  if (attrMatch) return { content: decodeXmlEntities(attrMatch[1]), xmlMeta };
  return { content: text, xmlMeta };
};

/**
 * 解析 QQ 音乐 QRC 歌词（支持纯文本与 XML 包裹格式）
 * @param text - QRC 歌词内容
 * @param options - 解析配置选项
 * @returns 歌词解析结果
 */
export const parseQRC = (text: string, options: ParseOptions = {}): LyricResult => {
  const { detectBackground = false, extractMetadata = false, cleanKangxi = false } = options;
  const normalized = cleanKangxi ? normalizeKangxi(text) : text;
  const { content, xmlMeta } = extractFromXml(normalized);
  const metadata: LyricMetadata =
    extractMetadata && xmlMeta
      ? { ...xmlMeta, timingMode: "Word" }
      : extractMetadata
        ? { timingMode: "Word" }
        : {};
  const lines: LyricLine[] = [];

  for (const raw of content.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const metaMatch = META_TAG_RE.exec(trimmed);
    if (metaMatch) {
      if (extractMetadata) {
        const key = metaMatch[1].toLowerCase();
        const val = metaMatch[2].trim();
        if (val) {
          if (key === "ti") metadata.title = [val];
          else if (key === "ar") metadata.artist = [val];
          else if (key === "al") metadata.album = [val];
          else if (key === "by") metadata.authors = [val];
          else if (key === "offset") {
            const off = parseInt(val, 10);
            if (!Number.isNaN(off)) metadata.offset = off;
          } else {
            (metadata.rawProperties ??= {})[key] = [val];
          }
        }
      }
      continue;
    }

    const header = LINE_HEADER_RE.exec(trimmed);
    if (!header) continue;

    const lineStart = parseInt(header[1], 10);
    const lineDur = parseInt(header[2], 10);
    const rest = trimmed.slice(header[0].length);

    const words = parseWords(rest);

    if (words.length === 0) continue;

    const line: LyricLine = {
      words,
      translatedLyric: "",
      romanLyric: "",
      startTime: lineStart,
      endTime: lineStart + lineDur,
      isBG: detectBackgroundLine(words, detectBackground),
      isDuet: false,
    };
    lines.push(line);
    if (!line.isBG) {
      const bg = splitTrailingBackground(line, detectBackground);
      if (bg) lines.push(bg);
    }
  }

  return {
    lines,
    metadata,
  };
};
