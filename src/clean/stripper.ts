/**
 * 元数据行清理器
 * 用于清理歌词中开头和结尾的制作人、词曲作者、版权声明等元数据行
 */

import type { LyricLine, StripOptions } from "../types";
import { getLineText } from "../utils/text";
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

/**
 * 归一化关键词字符串（转小写并移除空格）
 * @param str - 原始字符串
 * @returns 归一化后的字符串
 */
const normalizeKw = (str: string): string =>
  str.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** 模块级预归一化的默认关键词 */
const NORMALIZED_DEFAULT_KEYWORDS: readonly string[] = defaultKeywords.map(normalizeKw);

/** 模块级预编译的默认严格正则列表 */
const COMPILED_DEFAULT_REGEXES: readonly RegExp[] = defaultRegexes
  .map((pattern) => {
    try {
      return new RegExp(pattern, "i");
    } catch {
      return null;
    }
  })
  .filter((re): re is RegExp => re !== null);

interface ScanLimitConfig {
  ratio: number;
  minLines: number;
  maxLines: number;
}

const DEFAULT_HEADER_LIMIT: ScanLimitConfig = {
  ratio: 0.2,
  minLines: 40,
  maxLines: 140,
};

const DEFAULT_FOOTER_LIMIT: ScanLimitConfig = {
  ratio: 0.2,
  minLines: 40,
  maxLines: 100,
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
      const nextChar = normalizedText[kw.length];
      if (STRICT_MATCH_SEPARATORS.has(nextChar)) return true;
    }
  }
  for (const regex of regexes) {
    if (regex.test(text)) return true;
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
  for (const regex of softRegexes) {
    if (regex.test(text)) return true;
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
  for (let index = startIndex; index < limit; index++) {
    if (index >= lines.length) break;
    const text = getLineText(lines[index]);
    if (!text) continue;
    const strict = isStrictMatch(text, normalizedKeywords, regexes);
    const weak = looksLikeMetadata(text, softRegexes);
    if (!strict && !weak) break;
    if (strict) lastValidMetadataIndex = index;
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
  for (let index = lines.length - 1; index >= scanEnd; index--) {
    const text = getLineText(lines[index]);
    if (!text) continue;
    const strict = isStrictMatch(text, normalizedKeywords, regexes);
    const weak = looksLikeMetadata(text, softRegexes);
    if (!strict && !weak) break;
    if (strict) firstValidFooterIndex = index;
  }
  return firstValidFooterIndex;
};

/**
 * 剥离歌词中的元数据行（词/曲/编曲/制作/版权等）
 * @param lines - 原始歌词行列表
 * @param options - 清理选项（默认使用内置关键词与正则，并与用户传入合并去重）
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

  const useDefaultRules = options.useDefaultRules ?? true;

  let normalizedKeywords: readonly string[];
  if (!useDefaultRules) {
    normalizedKeywords = [...new Set((options.keywords ?? []).map(normalizeKw))];
  } else if (!options.keywords || options.keywords.length === 0) {
    normalizedKeywords = NORMALIZED_DEFAULT_KEYWORDS;
  } else {
    normalizedKeywords = [
      ...new Set([...NORMALIZED_DEFAULT_KEYWORDS, ...options.keywords.map(normalizeKw)]),
    ];
  }

  let regexes: readonly RegExp[];
  if (!useDefaultRules) {
    regexes = (options.regexPatterns ?? [])
      .map((pattern) => {
        try {
          return new RegExp(pattern, "i");
        } catch {
          return null;
        }
      })
      .filter((re): re is RegExp => re !== null);
  } else if (!options.regexPatterns || options.regexPatterns.length === 0) {
    regexes = COMPILED_DEFAULT_REGEXES;
  } else {
    const extraRegexes = (options.regexPatterns ?? [])
      .map((pattern) => {
        try {
          return new RegExp(pattern, "i");
        } catch {
          return null;
        }
      })
      .filter((re): re is RegExp => re !== null);
    regexes = [...COMPILED_DEFAULT_REGEXES, ...extraRegexes];
  }

  const rawSoftRegexes = options.softMatchRegexes ?? [];
  const softRegexes: RegExp[] = [];
  for (const pattern of rawSoftRegexes) {
    try {
      softRegexes.push(new RegExp(pattern, "i"));
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
