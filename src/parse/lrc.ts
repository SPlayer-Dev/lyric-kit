import { normalizeKangxi } from "../clean/kangxi";
import type { LyricLine, LyricMetadata, LyricResult, LyricWord, ParseOptions } from "../types";
import { detectBackgroundLine, splitTrailingBackground } from "../utils/bg";
import { ANGLE_TIME_RE, BRACKET_TIME_RE, MAX_TIME, parseTime } from "../utils/timestamp";

/** 匹配元数据标签（如 [ti:xxx]、[ar:xxx]、[offset:xxx]） */
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
 * 尝试解析尖括号逐字时间戳与歌词单词（LRC A2 / 增强 LRC）
 * @param content - 包含尖括号时间戳的歌词内容
 * @returns 单词数组，非尖括号逐字格式时返回 null
 */
const parseAngleWordTags = (content: string): LyricWord[] | null => {
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
 * 尝试解析行内方括号逐字时间戳与歌词单词（标准 ESLyric 逐字）
 * @param lineContent - 包含方括号逐字标签的文本内容
 * @param initialStartTime - 行首起始时间戳
 * @returns 单词数组，非逐字行时返回 null
 */
const parseBracketWordTags = (
  lineContent: string,
  initialStartTime: number,
): LyricWord[] | null => {
  BRACKET_TIME_RE.lastIndex = 0;
  const words: LyricWord[] = [];
  let prevTime = initialStartTime;
  let prevTextStart = 0;
  let tagCount = 0;
  let match: RegExpExecArray | null;

  while ((match = BRACKET_TIME_RE.exec(lineContent)) !== null) {
    const time = parseTime(match[1], match[2], match[3]);
    tagCount++;
    const rawWord = lineContent.slice(prevTextStart, match.index);
    if (rawWord.trim().length > 0) {
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

  if (tagCount === 0 || words.length === 0) return null;

  if (prevTextStart < lineContent.length) {
    const rawWord = lineContent.slice(prevTextStart);
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
 * @param detectBackground - 是否自动识别背景人声
 * @returns 解析出的歌词行列表
 */
const parseLrcPayload = (line: string, detectBackground: boolean): LyricLine[] => {
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

  const angleWords = parseAngleWordTags(content);
  if (angleWords) {
    const lines: LyricLine[] = [];
    for (const _ of times) {
      const words = times.length > 1 ? angleWords.map((w) => ({ ...w })) : angleWords;
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

  const bracketWords = parseBracketWordTags(content, times[0]);
  if (bracketWords) {
    const lines: LyricLine[] = [];
    lines.push({
      words: bracketWords,
      translatedLyric: "",
      romanLyric: "",
      startTime: bracketWords[0].startTime,
      endTime: bracketWords[bracketWords.length - 1].endTime,
      isBG: detectBackgroundLine(bracketWords, detectBackground),
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
 * 解析 LRC 歌词文本
 * @param text - LRC 文本内容
 * @param options - 解析配置选项
 * @returns 歌词解析结果
 */
export const parseLRC = (text: string, options: ParseOptions = {}): LyricResult => {
  const { detectBackground = false, extractMetadata = false, cleanKangxi = false } = options;
  const content = cleanKangxi ? normalizeKangxi(text) : text;

  const metadata: LyricMetadata = {};
  const lines: LyricLine[] = [];

  for (const rawLine of content.split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const metaMatch = META_TAG_RE.exec(trimmed);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();

      if (extractMetadata && val) {
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

      if (key === "bg") {
        const bgPayload = parseLrcPayload(val, detectBackground);
        for (const item of bgPayload) {
          item.isBG = true;
          lines.push(item);
        }
      }
      continue;
    }

    if (trimmed.startsWith("{")) continue;

    const parsedLines = parseLrcPayload(trimmed, detectBackground);
    for (const item of parsedLines) {
      lines.push(item);
      if (!item.isBG) {
        const bg = splitTrailingBackground(item, detectBackground);
        if (bg) lines.push(bg);
      }
    }
  }

  lines.sort((a, b) => a.startTime - b.startTime);

  const merged: LyricLine[] = [];
  for (const line of lines) {
    let target: LyricLine | undefined;
    for (let i = merged.length - 1; i >= 0; i--) {
      if (merged[i].startTime === line.startTime && merged[i].isBG === line.isBG) {
        target = merged[i];
        break;
      }
    }
    if (target) {
      const lineText = line.words
        .map((w) => w.word)
        .join("")
        .trim();
      if (!lineText) continue;
      if (!target.translatedLyric) {
        target.translatedLyric = lineText;
        continue;
      }
      if (!target.romanLyric) {
        target.romanLyric = lineText;
        continue;
      }
    }
    merged.push(line);
  }

  let nextDistinctStartTime = MAX_TIME;
  for (let i = merged.length - 1; i >= 0; i--) {
    const line = merged[i];
    if (line.endTime <= line.startTime) {
      line.endTime = nextDistinctStartTime;
    }
    const lastWord = line.words[line.words.length - 1];
    if (lastWord && lastWord.endTime <= lastWord.startTime) {
      lastWord.endTime = line.endTime;
    }
    if (line.words.length === 1 && line.words[0].endTime <= line.words[0].startTime) {
      line.words[0].endTime = line.endTime;
    }
    const prevLine = merged[i - 1];
    if (!prevLine || prevLine.startTime < line.startTime) {
      nextDistinctStartTime = line.startTime;
    }
  }

  const resultLines = merged.filter(
    (line) =>
      line.words
        .map((w) => w.word)
        .join("")
        .trim() !== "",
  );

  if (extractMetadata) {
    const hasWordTiming = resultLines.some((l) => (l.words?.length ?? 0) > 1);
    metadata.timingMode = hasWordTiming ? "Word" : "Line";
  }

  return {
    lines: resultLines,
    metadata,
  };
};
