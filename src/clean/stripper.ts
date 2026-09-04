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

const calculateScanLimit = (config: ScanLimitConfig, totalLines: number): number => {
  const proportional = Math.ceil(totalLines * config.ratio);
  const clamped = Math.max(config.minLines, Math.min(proportional, config.maxLines));
  return Math.min(clamped, totalLines);
};

const getLineText = (line: LyricLine): string => {
  if (!line?.words) return "";
  return line.words
    .map((w) => w.word)
    .join("")
    .trim();
};

/** 移除行首尾的括号 */
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

const normalizeKw = (s: string): string => s.toLowerCase().replace(/\s+/g, "");

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

const looksLikeMetadata = (text: string, softRegexes: readonly RegExp[]): boolean => {
  const cleaned = cleanTextForCheck(text);
  if (cleaned.includes(":") || cleaned.includes("：") || cleaned.includes("-")) return true;
  for (const reg of softRegexes) {
    if (reg.test(text)) return true;
  }
  return false;
};

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
 * @param lines 原始歌词行
 * @param options 清理选项（未指定则使用默认关键词与正则）
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
