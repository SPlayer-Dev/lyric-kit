import type { LyricLine, LyricWord } from "../types";
import { detectBackgroundLine, splitTrailingBackground } from "../utils/bg";
import { ANGLE_TIME_RE, BRACKET_TIME_RE, MAX_TIME, parseTime } from "../utils/timestamp";

/** 匹配元数据标签（如 [ti:xxx]、[ar:xxx]） */
const META_TAG_RE = /^\[([a-zA-Z]+):(.*?)]$/;

/** 检测尖括号逐字标签 */
const HAS_ANGLE_TAGS = /<\d+:\d+/;

/**
 * 提取行首连续的方括号时间戳
 * @param line - 原始行文本
 * @returns 时间戳数组和文本起始位置
 */
const extractHeaderTimes = (line: string): { times: number[]; textStart: number } => {
  BRACKET_TIME_RE.lastIndex = 0;
  const times: number[] = [];
  let textStart = 0;
  let match: RegExpExecArray | null;
  while ((match = BRACKET_TIME_RE.exec(line)) !== null) {
    if (match.index !== textStart) break;
    times.push(parseTime(match[1], match[2], match[3]));
    textStart = BRACKET_TIME_RE.lastIndex;
  }
  return { times, textStart };
};

/**
 * 尝试解析 ESLRC 逐字时间戳与歌词单词
 * @param content - 包含尖括号时间戳的歌词内容
 * @returns 单词数组，非 ESLRC 格式时返回 null
 */
const parseEslrcWords = (content: string): LyricWord[] | null => {
  if (!HAS_ANGLE_TAGS.test(content)) return null;
  ANGLE_TIME_RE.lastIndex = 0;
  const words: LyricWord[] = [];
  let match: RegExpExecArray | null;
  while ((match = ANGLE_TIME_RE.exec(content)) !== null) {
    const startTime = parseTime(match[1], match[2], match[3] ?? "0");
    const wordText = match[4];
    if (!wordText) {
      const lastWord = words[words.length - 1];
      if (lastWord && startTime >= lastWord.startTime) lastWord.endTime = startTime;
      continue;
    }
    const startsWithSpace = /^\s/.test(wordText);
    const endsWithSpace = /\s$/.test(wordText);
    const cleanWord = wordText.trim();
    if (startsWithSpace && words.length > 0) {
      words[words.length - 1].endsWithSpace = true;
    }
    if (cleanWord) {
      words.push({
        startTime,
        endTime: 0,
        word: cleanWord,
        endsWithSpace: endsWithSpace || undefined,
      });
    }
  }
  if (words.length === 0) return null;
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].endTime <= words[i].startTime) {
      words[i].endTime = words[i + 1].startTime;
    }
  }
  return words;
};

/**
 * 尝试解析行内方括号逐字时间戳与歌词单词
 * @param line - 包含方括号逐字标签的行内容
 * @returns 单词数组，非逐字行时返回 null
 */
const parseLrcWords = (line: string): LyricWord[] | null => {
  BRACKET_TIME_RE.lastIndex = 0;
  const words: LyricWord[] = [];
  let prevTime = -1;
  let prevTextStart = -1;
  let tagCount = 0;
  let match: RegExpExecArray | null;
  while ((match = BRACKET_TIME_RE.exec(line)) !== null) {
    const time = parseTime(match[1], match[2], match[3]);
    tagCount++;
    if (prevTime >= 0 && prevTextStart >= 0) {
      const rawWord = line.slice(prevTextStart, match.index);
      const startsWithSpace = /^\s/.test(rawWord);
      const endsWithSpace = /\s$/.test(rawWord);
      const cleanWord = rawWord.trim();
      if (startsWithSpace && words.length > 0) {
        words[words.length - 1].endsWithSpace = true;
      }
      if (cleanWord) {
        words.push({
          startTime: prevTime,
          endTime: time,
          word: cleanWord,
          endsWithSpace: endsWithSpace || undefined,
        });
      }
    }
    prevTime = time;
    prevTextStart = BRACKET_TIME_RE.lastIndex;
  }
  if (tagCount < 2 || words.length === 0) return null;
  if (prevTextStart < line.length) {
    const rawWord = line.slice(prevTextStart);
    const startsWithSpace = /^\s/.test(rawWord);
    const endsWithSpace = /\s$/.test(rawWord);
    const cleanWord = rawWord.trim();
    if (startsWithSpace && words.length > 0) {
      words[words.length - 1].endsWithSpace = true;
    }
    if (cleanWord) {
      words.push({
        startTime: prevTime,
        endTime: 0,
        word: cleanWord,
        endsWithSpace: endsWithSpace || undefined,
      });
    }
  }
  return words;
};

/**
 * 解析单行 LRC 内容负载，处理多时间戳并识别逐字或逐行歌词
 * @param line - 待解析的 LRC 单行文本
 * @param detectBackground - 是否自动识别背景人声，默认 true
 * @returns 解析出的歌词行列表
 */
const parseLrcPayload = (line: string, detectBackground: boolean = true): LyricLine[] => {
  const { times, textStart } = extractHeaderTimes(line);
  if (times.length === 0) return [];
  const content = line.slice(textStart);
  if (!content.trim()) {
    const lines: LyricLine[] = [];
    for (const t of times) {
      lines.push({
        words: [],
        translatedLyric: "",
        romanLyric: "",
        startTime: t,
        endTime: 0,
        isBG: false,
        isDuet: false,
      });
    }
    return lines;
  }
  const eslrcWords = parseEslrcWords(content);
  if (eslrcWords) {
    const lines: LyricLine[] = [];
    for (const _ of times) {
      const words = times.length > 1 ? eslrcWords.map((w) => ({ ...w })) : eslrcWords;
      lines.push({
        words,
        translatedLyric: "",
        romanLyric: "",
        startTime: words[0].startTime,
        endTime: words[words.length - 1].endTime,
        isBG: detectBackgroundLine(words, detectBackground),
        isDuet: false,
      });
    }
    return lines;
  }
  const lrcWords = parseLrcWords(line);
  if (lrcWords) {
    const lines: LyricLine[] = [];
    lines.push({
      words: lrcWords,
      translatedLyric: "",
      romanLyric: "",
      startTime: lrcWords[0].startTime,
      endTime: lrcWords[lrcWords.length - 1].endTime,
      isBG: detectBackgroundLine(lrcWords, detectBackground),
      isDuet: false,
    });
    return lines;
  }
  const lineWords = [{ startTime: 0, endTime: 0, word: content.trim() }];
  const isBG = detectBackgroundLine(lineWords, detectBackground);
  const lines: LyricLine[] = [];
  for (const t of times) {
    lines.push({
      words: [{ startTime: t, endTime: 0, word: lineWords[0].word }],
      translatedLyric: "",
      romanLyric: "",
      startTime: t,
      endTime: 0,
      isBG,
      isDuet: false,
    });
  }
  return lines;
};

/**
 * 解析单行 LRC 文本并处理元数据过滤与背景音分离
 * @param line - 待解析的原始行文本
 * @param detectBackground - 是否自动识别背景人声，默认 true
 * @returns 提取出的歌词行列表
 */
const parseLrcLine = (line: string, detectBackground: boolean = true): LyricLine[] => {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const match = META_TAG_RE.exec(trimmed);
  if (match) {
    const key = match[1];
    const value = match[2];

    if (key === "bg") {
      const lines = parseLrcPayload(value, detectBackground);
      if (lines.length === 1) {
        lines[0].isBG = true;
        return lines;
      }
    }

    return [];
  }

  if (line.startsWith("{")) return [];

  const lines = parseLrcPayload(trimmed, detectBackground);
  const result: LyricLine[] = [];
  for (const item of lines) {
    result.push(item);
    if (!item.isBG) {
      const bg = splitTrailingBackground(item, detectBackground);
      if (bg) result.push(bg);
    }
  }
  return result;
};

/**
 * 解析 LRC 歌词文本
 * @param text - LRC 文本内容
 * @param detectBackground - 是否自动识别背景人声，默认 true
 * @returns 解析后的歌词行数组，按时间升序排序
 */
export const parseLRC = (text: string, detectBackground = true): LyricLine[] => {
  const lines: LyricLine[] = [];
  for (const rawLine of text.split("\n")) {
    lines.push(...parseLrcLine(rawLine, detectBackground));
  }
  lines.sort((a, b) => a.startTime - b.startTime);

  const merged: LyricLine[] = [];
  for (const line of lines) {
    const prev = merged[merged.length - 1];
    if (prev && prev.startTime === line.startTime) {
      const lineText = line.words
        .map((w) => w.word)
        .join("")
        .trim();
      if (!lineText) continue;
      if (!prev.translatedLyric) prev.translatedLyric = lineText;
      else if (!prev.romanLyric) prev.romanLyric = lineText;
      continue;
    }
    merged.push(line);
  }

  let lastStartTime = MAX_TIME;
  for (let i = merged.length - 1; i >= 0; i--) {
    const line = merged[i];
    if (line.endTime <= line.startTime) {
      line.endTime = lastStartTime;
    }
    const lastWord = line.words[line.words.length - 1];
    if (lastWord && lastWord.endTime <= lastWord.startTime) {
      lastWord.endTime = line.endTime;
    }
    if (line.words.length === 1 && line.words[0].endTime <= line.words[0].startTime) {
      line.words[0].endTime = line.endTime;
    }
    lastStartTime = line.startTime;
  }
  return merged.filter(
    (line) =>
      line.words
        .map((w) => w.word)
        .join("")
        .trim() !== "",
  );
};
