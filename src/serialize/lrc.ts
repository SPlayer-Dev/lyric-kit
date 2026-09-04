import type { LyricLine } from "../types";
import { formatLrcTime } from "../utils/timestamp";

/**
 * 获取歌词行包含词尾空格的完整主文本
 * @param line - 歌词行对象
 * @returns 拼接后的整行文本
 */
const lineMainText = (line: LyricLine): string =>
  line.words
    .map((word) => word.word + (word.endsWithSpace ? " " : ""))
    .join("")
    .trim();

/**
 * 将歌词行序列化为标准逐行 LRC 格式
 * @param lines - 歌词行数组
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
 * 将歌词行序列化为逐字增强型 LRC 格式
 * @param lines - 歌词行数组
 * @returns 增强型 LRC 格式字符串
 */
export const toEnhancedLrc = (lines: LyricLine[]): string => {
  const out: string[] = [];
  for (const line of lines) {
    if (line.words.length === 0) continue;
    const lineTs = `[${formatLrcTime(line.startTime)}]`;
    const body = line.words
      .map(
        (word) => `<${formatLrcTime(word.startTime)}>${word.word}${word.endsWithSpace ? " " : ""}`,
      )
      .join("");
    if (!body.trim()) continue;
    out.push(`${lineTs}${body}`);
    if (line.translatedLyric) out.push(`${lineTs}${line.translatedLyric}`);
  }
  return out.join("\n");
};
