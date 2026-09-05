import type { LyricLine, LyricMetadata, LyricResult, LyricWord, ParseOptions } from "../types";
import { detectBackgroundLine } from "../utils/bg";
import { parseTime } from "../utils/timestamp";

/** 行头时间戳：[mm:ss.xxx] / [mm:ss:xxx] */
const TIME_HEADER_RE = /^\[(\d+):(\d+)[.:](\d{1,3})\]/;

/** 行头毫秒数：[起始ms, 时长ms] */
const MS_HEADER_RE = /^\[(\d+),(\d+)\]/;

/** 匹配元数据标签（如 [ti:xxx]、[ar:xxx]） */
const META_TAG_RE = /^\[([a-zA-Z]+):(.*?)]$/;

/** 行内逐字：<offset,dur>字 或 <offset,dur,0>字 */
const WORD_RE = /<(\d+),(\d+)(?:,\d+)?>([^<]*)/g;

/** 跨环境 Base64 UTF-8 解码 */
const decodeBase64Utf8 = (str: string): string => {
  try {
    const raw = globalThis.atob(str);
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
};

/**
 * 解析酷狗音乐 KRC 歌词（解密后的纯文本）
 * @param text - 解密后的 KRC 文本内容
 * @param options - 解析配置选项
 * @returns 歌词解析结果
 */
export const parseKRC = (text: string, options?: ParseOptions): LyricResult => {
  const detectBackground = options?.detectBackground ?? false;
  const extractMetadata = options?.extractMetadata ?? false;

  const metadata: LyricMetadata = extractMetadata ? { timingMode: "Word" } : {};
  const lines: LyricLine[] = [];
  let krcTranslations: string[] = [];
  let krcRomanizations: string[] = [];

  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const metaMatch = META_TAG_RE.exec(trimmed);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();
      if (key === "language") {
        const isBase64 = val.startsWith("ey") || val.startsWith("{");
        if (isBase64) {
          try {
            const jsonStr = val.startsWith("{") ? val : decodeBase64Utf8(val);
            const data = JSON.parse(jsonStr) as {
              content?: Array<{
                type: number;
                lyricContent?: Array<string[] | string>;
              }>;
            };
            if (Array.isArray(data.content)) {
              for (const c of data.content) {
                if (c.type === 1 && Array.isArray(c.lyricContent)) {
                  krcTranslations = c.lyricContent.map((row) =>
                    Array.isArray(row) ? row.join("") : String(row),
                  );
                } else if (c.type === 0 && Array.isArray(c.lyricContent)) {
                  krcRomanizations = c.lyricContent.map((row) =>
                    Array.isArray(row) ? row.join("") : String(row),
                  );
                }
              }
            }
          } catch {
            // 忽略非法数据
          }
        } else if (extractMetadata) {
          metadata.language = val;
        }
      } else if (extractMetadata && val) {
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
      continue;
    }

    let lineStart = 0;
    let lineDur = 0;
    let headerLen = 0;

    const timeHeader = TIME_HEADER_RE.exec(trimmed);
    if (timeHeader) {
      lineStart = parseTime(timeHeader[1], timeHeader[2], timeHeader[3], false);
      headerLen = timeHeader[0].length;
    } else {
      const msHeader = MS_HEADER_RE.exec(trimmed);
      if (msHeader) {
        lineStart = parseInt(msHeader[1], 10);
        lineDur = parseInt(msHeader[2], 10);
        headerLen = msHeader[0].length;
      } else {
        continue;
      }
    }

    const rest = trimmed.slice(headerLen);

    WORD_RE.lastIndex = 0;
    const words: LyricWord[] = [];
    let match: RegExpExecArray | null;
    let lastEnd = lineStart;
    while ((match = WORD_RE.exec(rest)) !== null) {
      const rawWord = match[3];
      if (!rawWord) continue;
      const offset = parseInt(match[1], 10);
      const dur = parseInt(match[2], 10);
      const start = lineStart + offset;
      const end = start + dur;

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
          endTime: end,
          endsWithSpace: endsWithSpace || undefined,
        });
      }
      lastEnd = Math.max(lastEnd, end);
    }

    if (words.length > 0) {
      delete words[words.length - 1].endsWithSpace;
    }

    if (words.length === 0) continue;

    const calculatedEnd = lineDur > 0 ? lineStart + lineDur : lastEnd;
    lines.push({
      words,
      translatedLyric: "",
      romanLyric: "",
      startTime: lineStart,
      endTime: calculatedEnd,
      isBG: detectBackgroundLine(words, detectBackground),
      isDuet: false,
    });
  }

  if (krcTranslations.length > 0 || krcRomanizations.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      if (i < krcTranslations.length && krcTranslations[i]) {
        lines[i].translatedLyric = krcTranslations[i];
      }
      if (i < krcRomanizations.length && krcRomanizations[i]) {
        lines[i].romanLyric = krcRomanizations[i];
      }
    }
  }

  return {
    lines,
    metadata,
  };
};
