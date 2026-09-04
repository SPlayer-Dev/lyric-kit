import type { LyricLine } from "../types";
import { formatLrcTime } from "../utils/timestamp";

const lineMainText = (line: LyricLine): string =>
  line.words
    .map((word) => word.word)
    .join("")
    .trim();

/**
 * 将歌词行序列化为标准逐行 LRC
 * 双语时翻译行紧随主歌词、共用时间戳
 * @param lines 歌词行数组
 * @returns LRC 格式字符串
 */
export const toLrc = (lines: LyricLine[]): string => {
  const out: string[] = [];
  for (const line of lines) {
    const text = lineMainText(line);
    if (!text) continue;
    const ts = `[${formatLrcTime(line.startTime)}]`;
    out.push(`${ts}${text}`);
    if (line.translatedLyric) out.push(`${ts}${line.translatedLyric}`);
  }
  return out.join("\n");
};

/**
 * 将歌词行序列化为逐字增强型 LRC（A2 内联 <mm:ss.xx> 时间戳）
 * 翻译降级为整行
 * @param lines 歌词行数组
 * @returns 增强型 LRC 格式字符串
 */
export const toEnhancedLrc = (lines: LyricLine[]): string => {
  const out: string[] = [];
  for (const line of lines) {
    if (line.words.length === 0) continue;
    const lineTs = `[${formatLrcTime(line.startTime)}]`;
    const body = line.words
      .map((word) => `<${formatLrcTime(word.startTime)}>${word.word}`)
      .join("");
    if (!body.trim()) continue;
    out.push(`${lineTs}${body}`);
    if (line.translatedLyric) out.push(`${lineTs}${line.translatedLyric}`);
  }
  return out.join("\n");
};
