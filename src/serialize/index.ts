import { parseLyric } from "../parse";
import type {
  LyricInput,
  LyricLine,
  LyricResult,
  ParseOptions,
  SerializeLyricFormat,
} from "../types";
import { toEnhancedLRC, toLRC } from "./lrc";
import { toSRT } from "./srt";
import { toTTML } from "./ttml";

export { toEnhancedLRC, toLRC } from "./lrc";
export { toSRT } from "./srt";
export { toTTML } from "./ttml";

/**
 * 歌词序列化统一入口函数
 * @param input - 待序列化的歌词行数组、LyricResult 解析结果、LyricInput 对象或原生歌词字符串
 * @param target - 目标导出格式
 * @default "lrc"
 * @param options - 若 input 为文本或配置对象时传递给解析器的配置选项
 * @returns 格式化后的字符串；若无有效内容返回空字符串
 */
export const serializeLyric = (
  input: LyricLine[] | LyricResult | LyricInput | string,
  target: SerializeLyricFormat = "lrc",
  options: ParseOptions = {},
): string => {
  const parsed = Array.isArray(input)
    ? { lines: input, metadata: {} }
    : typeof input === "string"
      ? parseLyric(input, { extractMetadata: true, ...options })
      : "lines" in input
        ? input
        : parseLyric(input, { extractMetadata: true, ...options });

  if (!parsed.lines || parsed.lines.length === 0) return "";

  switch (target) {
    case "ttml":
      return toTTML(parsed);
    case "elrc":
      return toEnhancedLRC(parsed.lines);
    case "srt":
      return toSRT(parsed.lines);
    default:
      return toLRC(parsed.lines);
  }
};
