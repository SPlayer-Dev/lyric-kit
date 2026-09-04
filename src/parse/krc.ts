import type { LyricLine, LyricWord } from "../types";
import { detectBackgroundLine } from "../utils/bg";
import { parseTime } from "../utils/timestamp";

/** 行头：[mm:ss.xxx] / [mm:ss:xxx]，支持 1~3 位毫秒 */
const LINE_HEADER_RE = /^\[(\d+):(\d+)[.:](\d{1,3})\]/;

/** 行内逐字：<offset,dur>字（字为到下一个 `<` 或行尾前的所有字符） */
const WORD_RE = /<(\d+),(\d+)>([^<]*)/g;

/**
 * 解析酷狗音乐 KRC 歌词（解密后的纯文本）
 * @param text - 解密后的 KRC 文本内容
 * @param detectBackground - 是否自动识别背景人声，默认 true
 * @returns 解析后的歌词行数组
 */
export const parseKRC = (text: string, detectBackground = true): LyricLine[] => {
  const lines: LyricLine[] = [];

  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const header = LINE_HEADER_RE.exec(trimmed);
    if (!header) continue;

    // krc 的时间第三位永远是毫秒数，设置 padEndMs = false
    const lineStart = parseTime(header[1], header[2], header[3], false);
    const rest = trimmed.slice(header[0].length);

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

    lines.push({
      words,
      translatedLyric: "",
      romanLyric: "",
      startTime: lineStart,
      endTime: lastEnd,
      isBG: detectBackgroundLine(words, detectBackground),
      isDuet: false,
    });
  }

  return lines;
};
