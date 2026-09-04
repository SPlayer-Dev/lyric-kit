import type { LyricLine, LyricWord } from "../types";

/** 匹配行头属性码 [0]~[9] */
const PROP_RE = /^\[(\d)\]/;

/** 匹配逐字时间戳：文字(起始ms,时长ms) */
const WORD_RE = /([^(]+)\((\d+),(\d+)\)/g;

/**
 * 解析属性码为背景音与对唱状态
 * @param code - LyS 行头数字属性码（0~9）
 * @returns 包含 isBG 与 isDuet 的状态对象
 */
const parseProperty = (code: number): { isBG: boolean; isDuet: boolean } => {
  switch (code) {
    case 2:
    case 5:
      return { isBG: false, isDuet: true };
    case 6:
    case 7:
      return { isBG: true, isDuet: false };
    case 8:
      return { isBG: true, isDuet: true };
    default:
      return { isBG: false, isDuet: false };
  }
};

/**
 * 解析 LyS（Lyricify Syllable）歌词文本
 * @param text - LyS 文本内容
 * @returns 解析后的歌词行数组
 */
export const parseLyS = (text: string): LyricLine[] => {
  const lines: LyricLine[] = [];

  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const propMatch = PROP_RE.exec(trimmed);
    if (!propMatch) continue;

    const { isBG, isDuet } = parseProperty(parseInt(propMatch[1], 10));
    const rest = trimmed.slice(propMatch[0].length);

    WORD_RE.lastIndex = 0;
    const words: LyricWord[] = [];
    let match: RegExpExecArray | null;
    while ((match = WORD_RE.exec(rest)) !== null) {
      const wordStart = parseInt(match[2], 10);
      const wordDur = parseInt(match[3], 10);
      words.push({
        word: match[1],
        startTime: wordStart,
        endTime: wordStart + wordDur,
      });
    }

    if (words.length === 0) continue;

    lines.push({
      words,
      translatedLyric: "",
      romanLyric: "",
      startTime: words[0].startTime,
      endTime: words[words.length - 1].endTime,
      isBG,
      isDuet,
    });
  }

  return lines;
};
