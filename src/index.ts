/**
 * lyric-kit
 * A lightweight, zero-dependency toolkit for parsing, serializing, and processing lyrics
 */

export { extractLyricAuthors } from "./clean/author";
export {
  defaultKeywords,
  defaultKeywords as excludeKeywords,
  defaultRegexes,
  defaultRegexes as excludeRegexes,
} from "./clean/excludeRules";
export { normalizeKangxi } from "./clean/kangxi";
export { applyLyricLanguages } from "./clean/language";
export { normalizeLyricLines } from "./clean/normalize";
// 4. 清洗与归一化
export { stripLyricMetadata } from "./clean/stripper";
// 2. 解析器
export {
  bestExternalIndex,
  detectFormat,
  pairTranslation,
  parseASS,
  parseKRC,
  parseLRC,
  parseLyric,
  parseLyS,
  parseQRC,
  parseSRT,
  parseTTML,
  parseYRC,
} from "./parse";
// 3. 序列化器
export {
  serializeLyric,
  toEnhancedLrc,
  toLrc,
  toSrt,
  toTtml,
} from "./serialize";
// 1. 类型定义
export type {
  LyricFormat,
  LyricInput,
  LyricLanguage,
  LyricLine,
  LyricSource,
  LyricSpan,
  LyricWord,
  ParseLyricOptions,
  SerializeLyricFormat,
  StripOptions,
} from "./types";
export { DEFAULT_LYRIC_FORMAT_ORDER } from "./types";
export { detectBackgroundLine, splitTrailingBackground } from "./utils/bg";
export { getWordSweepProgress } from "./utils/sweep";
export {
  clampLastLineEnd,
  findActiveLyricIndices,
  findLyricIndex,
  pickAdvanceOnEndIndex,
  pickLatestStartedIndex,
  pickPrimaryIndex,
} from "./utils/sync";
// 5. 时间与播放算法
export {
  ANGLE_TIME_RE,
  BRACKET_TIME_RE,
  formatLrcTime,
  formatSrtTime,
  formatTtmlTime,
  MAX_TIME,
  parseBracketTag,
  parseTime,
  parseTTMLTime,
} from "./utils/timestamp";
export { transformLyricText } from "./utils/transform";
