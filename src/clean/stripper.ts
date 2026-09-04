/**
 * 元数据行清理器
 * 用于清理歌词中开头和结尾的制作人、词曲作者、版权声明等元数据行
 */

import type { LyricLine, StripOptions } from "../types";
import { defaultKeywords, defaultRegexes } from "./excludeRules";

const STRICT_MATCH_SEPARATORS = new Set([
  ":",
  "：",
  ",",
  "，",
  ".",
  "。",
  "!",
  "！",
  "-",
  "_",
  "(",
  "（",
  "[",
  "【",
  "{",
  "『",
  "「",
]);

interface ScanLimitConfig {
  ratio: number;
  minLines: number;
  maxLines: number;
}

const DEFAULT_HEADER_LIMIT: ScanLimitConfig = {
  ratio: 0.2,
  minLines: 20,
  maxLines: 70,
};

const DEFAULT_FOOTER_LIMIT: ScanLimitConfig = {
  ratio: 0.2,
  minLines: 20,
  maxLines: 50,
};

/**
 * 计算动态扫描行数限制
 * @param config - 扫描限制配置对象
 * @param totalLines - 歌词总行数
 * @returns 最终计算出的最大扫描行数
 */
const calculateScanLimit = (config: ScanLimitConfig, totalLines: number): number => {
  const proportional = Math.ceil(totalLines * config.ratio);
  const clamped = Math.max(config.minLines, Math.min(proportional, config.maxLines));
  return Math.min(clamped, totalLines);
};

/**
 * 提取歌词行的纯文本内容
 * @param line - 歌词行对象
 * @returns 拼接后的纯文本字符串
 */
const getLineText = (line: LyricLine): string => {
  if (!line?.words) return "";
  return line.words
    .map((w) => w.word)
    .join("")
    .trim();
};

/**
 * 清除行两端的外层包装括号
 * @param text - 原始行文本
 * @returns 剥除括号后的文本
 */
const cleanTextForCheck = (text: string): string => {
  let processed = text.trim();
  const brackets: ReadonlyArray<readonly [string, string]> = [
    ["(", ")"],
    ["（", "）"],
    ["【", "】"],
    ["[", "]"],
    ["{", "}"],
    ["『", "』"],
    ["「", "」"],
  ];

  let changed = true;
  let loopCount = 0;
  while (changed && loopCount < 5) {
    changed = false;
    loopCount++;
    for (const [open, close] of brackets) {
      if (processed.startsWith(open)) {
        if (processed.endsWith(close)) {
          processed = processed.slice(open.length, processed.length - close.length).trim();
          changed = true;
          break;
        }
        const closeIdx = processed.indexOf(close);
        if (closeIdx > -1) {
          const contentAfter = processed.slice(closeIdx + close.length).trim();
          if (contentAfter.length > 0) {
            processed = contentAfter;
            changed = true;
            break;
          }
        }
      }
    }
  }
  return processed;
};

/**
 * 归一化关键词字符串（转小写并移除空格）
 * @param s - 原始字符串
 * @returns 归一化后的字符串
 */
const normalizeKw = (s: string): string => s.toLowerCase().replace(/\s+/g, "");

/**
 * 检查文本是否严格匹配元数据关键词或正则表达式
 * @param text - 待检查的文本
 * @param normalizedKeywords - 归一化的关键词列表
 * @param regexes - 正则表达式列表
 * @returns 是否严格匹配
 */
const isStrictMatch = (
  text: string,
  normalizedKeywords: readonly string[],
  regexes: readonly RegExp[],
): boolean => {
  const cleaned = cleanTextForCheck(text);
  const normalizedText = normalizeKw(cleaned);

  for (const kw of normalizedKeywords) {
    if (normalizedText.startsWith(kw)) {
      if (normalizedText.length === kw.length) return true;
      if (STRICT_MATCH_SEPARATORS.has(normalizedText.charAt(kw.length))) return true;
    }
  }
  for (const reg of regexes) {
    if (reg.test(text)) return true;
  }
  return false;
};

/**
 * 检查文本是否包含弱元数据特征（如冒号或匹配弱正则）
 * @param text - 待检查的文本
 * @param softRegexes - 弱匹配正则表达式列表
 * @returns 是否具备元数据特征
 */
const looksLikeMetadata = (text: string, softRegexes: readonly RegExp[]): boolean => {
  const cleaned = cleanTextForCheck(text);
  if (cleaned.includes(":") || cleaned.includes("：") || cleaned.includes("-")) return true;
  for (const reg of softRegexes) {
    if (reg.test(text)) return true;
  }
  return false;
};

/**
 * 查找头部连续元数据的截止位置
 * @param lines - 歌词行列表
 * @param startIndex - 扫描起始下标
 * @param normalizedKeywords - 归一化关键词列表
 * @param regexes - 严格正则表达式列表
 * @param softRegexes - 弱匹配正则表达式列表
 * @param limit - 最大扫描行数
 * @returns 头部有效歌词的起始下标
 */
const findHeaderCutoff = (
  lines: readonly LyricLine[],
  startIndex: number,
  normalizedKeywords: readonly string[],
  regexes: readonly RegExp[],
  softRegexes: readonly RegExp[],
  limit: number,
): number => {
  let lastValidMetadataIndex = startIndex - 1;
  for (let i = startIndex; i < limit; i++) {
    if (i >= lines.length) break;
    const text = getLineText(lines[i]);
    if (!text) continue;
    const strict = isStrictMatch(text, normalizedKeywords, regexes);
    const weak = looksLikeMetadata(text, softRegexes);
    if (!strict && !weak) break;
    if (strict) lastValidMetadataIndex = i;
  }
  return lastValidMetadataIndex + 1;
};

/**
 * 查找尾部连续元数据的起始位置
 * @param lines - 歌词行列表
 * @param startIndex - 扫描起始下限
 * @param normalizedKeywords - 归一化关键词列表
 * @param regexes - 严格正则表达式列表
 * @param softRegexes - 弱匹配正则表达式列表
 * @param limit - 最大扫描行数
 * @returns 尾部元数据开始的下标
 */
const findFooterCutoff = (
  lines: readonly LyricLine[],
  startIndex: number,
  normalizedKeywords: readonly string[],
  regexes: readonly RegExp[],
  softRegexes: readonly RegExp[],
  limit: number,
): number => {
  if (startIndex >= lines.length) return startIndex;
  const scanEnd = Math.max(startIndex, lines.length - limit);
  let firstValidFooterIndex = lines.length;
  for (let i = lines.length - 1; i >= scanEnd; i--) {
    const text = getLineText(lines[i]);
    if (!text) continue;
    const strict = isStrictMatch(text, normalizedKeywords, regexes);
    const weak = looksLikeMetadata(text, softRegexes);
    if (!strict && !weak) break;
    if (strict) firstValidFooterIndex = i;
  }
  return firstValidFooterIndex;
};

/**
 * 剥离歌词中的元数据行（词/曲/编曲/制作/版权等）
 * @param lines - 原始歌词行列表
 * @param options - 清理选项（未指定则使用默认关键词与正则）
 * @returns 剥离元数据后的歌词行列表
 */
export const stripLyricMetadata = (
  lines: readonly LyricLine[],
  options: StripOptions = {},
): LyricLine[] => {
  if (!lines || lines.length === 0) return [];

  let scanStartIndex = 0;
  if (options.matchMetadata) {
    const { title, artists } = options.matchMetadata;
    const firstLineText = getLineText(lines[0]);
    if (title && artists && artists.length > 0 && firstLineText) {
      const lowerText = firstLineText.toLowerCase();
      const lowerTitle = title.toLowerCase();
      if (lowerText.includes(lowerTitle)) {
        const hasAnyArtist = artists.some((artist) => lowerText.includes(artist.toLowerCase()));
        if (hasAnyArtist) scanStartIndex = 1;
      }
    }
  }

  const rawKeywords = options.keywords ?? defaultKeywords;
  const rawRegexes = options.regexPatterns ?? defaultRegexes;
  const rawSoftRegexes = options.softMatchRegexes ?? [];

  const normalizedKeywords = rawKeywords.map(normalizeKw);

  const regexes: RegExp[] = [];
  for (const p of rawRegexes) {
    try {
      regexes.push(new RegExp(p, "i"));
    } catch {
      // 忽略非法正则
    }
  }

  const softRegexes: RegExp[] = [];
  for (const p of rawSoftRegexes) {
    try {
      softRegexes.push(new RegExp(p, "i"));
    } catch {
      // 忽略非法正则
    }
  }

  const headerLimit = calculateScanLimit(DEFAULT_HEADER_LIMIT, lines.length);
  const footerLimit = calculateScanLimit(DEFAULT_FOOTER_LIMIT, lines.length);

  const startIdx = findHeaderCutoff(
    lines,
    scanStartIndex,
    normalizedKeywords,
    regexes,
    softRegexes,
    headerLimit,
  );

  const endIdx = findFooterCutoff(
    lines,
    startIdx,
    normalizedKeywords,
    regexes,
    softRegexes,
    footerLimit,
  );

  if (startIdx === 0 && endIdx === lines.length) return lines as LyricLine[];

  return lines.slice(startIdx, endIdx);
};
