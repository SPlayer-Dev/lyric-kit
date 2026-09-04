import { parseLyric } from "../parse";
import type { LyricInput, LyricLine, SerializeLyricFormat } from "../types";
import { toEnhancedLrc, toLrc } from "./lrc";
import { toSrt } from "./srt";
import { toTtml } from "./ttml";

export { toEnhancedLrc, toLrc } from "./lrc";
export { toSrt } from "./srt";
export { toTtml } from "./ttml";

/**
 * 歌词序列化统一入口函数
 * @param input - 待序列化的歌词行数组或原始 LyricInput
 * @param target - 目标导出格式："lrc" | "elrc" | "ttml" | "srt"
 * @returns 格式化后的字符串；若无有效内容返回空字符串
 */
export const serializeLyric = (
  input: LyricLine[] | LyricInput,
  target: SerializeLyricFormat = "lrc",
): string => {
  const lines = Array.isArray(input) ? input : parseLyric(input);
  if (!lines || lines.length === 0) return "";

  switch (target) {
    case "ttml":
      return toTtml(lines);
    case "elrc":
      return toEnhancedLrc(lines);
    case "srt":
      return toSrt(lines);
    default:
      return toLrc(lines);
  }
};
