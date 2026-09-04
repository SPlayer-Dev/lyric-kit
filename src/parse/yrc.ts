import type { LyricLine, LyricWord } from "../types";
import { detectBackgroundLine, splitTrailingBackground } from "../utils/bg";

/** 行头：[起始毫秒, 时长毫秒] */
const LINE_HEADER_RE = /^\[(\d+),(\d+)\]/;

/** 字级：(起始毫秒, 时长毫秒, 0)文字 */
const WORD_RE = /\((\d+),(\d+),\d+\)([^(]*)/g;

/**
 * 解析网易云音乐 YRC 逐字歌词
 * @param text - YRC 文本内容
 * @param detectBackground - 是否自动识别背景人声，默认 true
 * @returns 解析后的歌词行数组
 */
export const parseYRC = (text: string, detectBackground = true): LyricLine[] => {
  const lines: LyricLine[] = [];

  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const header = LINE_HEADER_RE.exec(trimmed);
    if (!header) continue;

    const lineStart = parseInt(header[1], 10);
    const lineDur = parseInt(header[2], 10);
    const rest = trimmed.slice(header[0].length);

    WORD_RE.lastIndex = 0;
    const words: LyricWord[] = [];
    let match: RegExpExecArray | null;
    while ((match = WORD_RE.exec(rest)) !== null) {
      const start = parseInt(match[1], 10);
      const dur = parseInt(match[2], 10);
      const rawWord = match[3];
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

  return lines;
};
