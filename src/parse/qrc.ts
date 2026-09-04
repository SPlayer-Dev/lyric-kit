import type { LyricLine, LyricWord } from "../types";
import { detectBackgroundLine, splitTrailingBackground } from "../utils/bg";

/** 行头：[起始毫秒, 时长毫秒] */
const LINE_HEADER_RE = /^\[(\d+),(\d+)\]/;

/** 时间标记开头：`(` 紧跟数字 */
const TIMING_RE = /\((\d+),(\d+)\)/;

/**
 * 逐字符解析单行 QRC 字级歌词与时间戳
 * @param rest - 行头时间戳之后的行文本内容
 * @returns 解析出的歌词单词列表
 */
const parseWords = (rest: string): LyricWord[] => {
  const words: LyricWord[] = [];
  let pos = 0;

  while (pos < rest.length) {
    let timingIdx = rest.indexOf("(", pos);
    while (timingIdx !== -1 && timingIdx + 1 < rest.length && !/\d/.test(rest[timingIdx + 1])) {
      timingIdx = rest.indexOf("(", timingIdx + 1);
    }
    if (timingIdx === -1 || timingIdx + 1 >= rest.length) break;

    const timingSub = rest.slice(timingIdx);
    const timingMatch = TIMING_RE.exec(timingSub);
    if (!timingMatch) break;

    const start = parseInt(timingMatch[1], 10);
    const dur = parseInt(timingMatch[2], 10);

    for (let i = pos; i < timingIdx; i++) {
      if (rest[i] === "(") {
        words.push({ word: "(", startTime: start, endTime: start + dur });
      }
    }

    const wordText = rest.slice(pos, timingIdx).replace(/\(/g, "");
    if (wordText) {
      const startsWithSpace = /^\s/.test(wordText);
      const endsWithSpace = /\s$/.test(wordText);
      const cleanWord = wordText.trim();
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

    pos = timingIdx + timingMatch[0].length;

    if (pos < rest.length && rest[pos] === ")") {
      words.push({ word: ")", startTime: start, endTime: start + dur });
      pos++;
    }
  }

  if (words.length > 0) {
    delete words[words.length - 1].endsWithSpace;
  }

  return words;
};

/**
 * 从 XML 包裹结构中提取 QRC 纯文本歌词内容
 * @param text - 原始 QRC 文本（可能包含 XML 标签）
 * @returns 提取出的纯文本歌词
 */
const extractFromXml = (text: string): string => {
  if (!text.trimStart().startsWith("<")) return text;
  const greedyMatch = text.match(/LyricContent="([\s\S]*)"\s*\/?>/);
  if (greedyMatch) return greedyMatch[1];
  const cdataMatch = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdataMatch) return cdataMatch[1];
  const attrMatch = text.match(/LyricContent="([^"]*)"/);
  if (attrMatch) return attrMatch[1];
  return text;
};

/**
 * 解析 QQ 音乐 QRC 歌词（支持纯文本与 XML 包裹格式）
 * @param text - QRC 歌词内容
 * @param detectBackground - 是否自动识别背景人声，默认 true
 * @returns 解析后的歌词行数组
 */
export const parseQRC = (text: string, detectBackground = true): LyricLine[] => {
  const content = extractFromXml(text);
  const lines: LyricLine[] = [];

  for (const raw of content.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

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

  return lines;
};
