import { normalizeKangxi } from "../clean/kangxi";
import type { LyricFormat, LyricInput, LyricLine, ParseLyricOptions } from "../types";
import { DEFAULT_LYRIC_FORMAT_ORDER } from "../types";
import { parseASS } from "./ass";
import { parseKRC } from "./krc";
import { parseLRC } from "./lrc";
import { parseLyS } from "./lys";
import { parseQRC } from "./qrc";
import { parseSRT } from "./srt";
import { parseTTML } from "./ttml";
import { parseYRC } from "./yrc";

export { parseASS } from "./ass";
export { parseKRC } from "./krc";
export { parseLRC } from "./lrc";
export { parseLyS } from "./lys";
export { parseQRC } from "./qrc";
export { parseSRT } from "./srt";
export type {
  DOMParserConstructor,
  DOMParserLike,
  ParseTTMLFunction,
  ParseTTMLOptions,
} from "./ttml";
export { parseTTML } from "./ttml";
export { parseYRC } from "./yrc";

/** 对齐容差（毫秒） */
const ALIGN_TOLERANCE_MS = 300;

/**
 * 从外部歌词列表中选出最优格式的索引
 * @param lyrics - 外部歌词列表
 * @param priority - 自定义格式优先级列表
 * @returns 最优格式的索引，无可用歌词时返回 -1
 */
export const bestExternalIndex = (
  lyrics: { format: LyricFormat }[],
  priority?: readonly LyricFormat[],
): number => {
  if (lyrics.length === 0) return -1;
  const order = priority && priority.length > 0 ? priority : DEFAULT_LYRIC_FORMAT_ORDER;
  let bestIdx = 0;
  let bestPriority = order.length;
  for (let i = 0; i < lyrics.length; i++) {
    const p = order.indexOf(lyrics[i].format);
    const rank = p === -1 ? order.length : p;
    if (rank < bestPriority) {
      bestPriority = rank;
      bestIdx = i;
    }
  }
  return bestIdx;
};

/**
 * 根据内容特征检测歌词格式
 * @param text - 歌词文本内容
 * @returns 检测到的格式，默认 "lrc"
 */
export const detectFormat = (text: string): LyricFormat => {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("[Script Info]") || /^\[V4\+? Styles\]/m.test(text)) return "ass";
  if (/^\d+\r?\n\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(trimmed)) return "srt";
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
    if (/LyricContent="|<QrcInfos|<Lyric_/.test(text)) return "qrc";
    if (trimmed.startsWith("<tt") || /<tt\s/i.test(text)) return "ttml";
  }
  if (/\[\d+,\d+\]\(\d+,\d+,\d+\)/.test(text)) return "yrc";
  if (/\[\d+,\d+\][^[\n]+\(\d+,\d+\)/.test(text)) return "qrc";
  if (/^\[\d\][^[\]]+\(\d+,\d+\)/m.test(text)) return "lys";
  return "lrc";
};

/**
 * 根据指定格式调用对应的解析器解析歌词内容
 * @param text - 待解析的歌词文本
 * @param format - 歌词格式
 * @param options - 解析配置选项
 * @returns 解析后的歌词行数组
 */
const parseContent = (
  text: string,
  format: LyricFormat,
  options: ParseLyricOptions = {},
): LyricLine[] => {
  const detectBackground = options.detectBackground !== false;
  switch (format) {
    case "ttml":
      return parseTTML(text, {
        preferredLang: options.preferredLang,
        domParser: options.domParser,
      });
    case "qrc":
      return parseQRC(text, detectBackground);
    case "krc":
      return parseKRC(text, detectBackground);
    case "yrc":
      return parseYRC(text, detectBackground);
    case "lrc":
      return parseLRC(text, detectBackground);
    case "lys":
      return parseLyS(text);
    case "srt":
      return parseSRT(text);
    case "ass":
      return parseASS(text);
  }
};

/**
 * 获取单行歌词的所有词拼接纯文本
 * @param line - 歌词行对象
 * @returns 拼接后的纯文本字符串
 */
const lineText = (line: LyricLine): string =>
  line.words
    .map((w) => w.word)
    .join("")
    .trim();

/**
 * 校验翻译文本是否包含有效歌词内容
 * @param text - 待检查的翻译文本
 * @returns 是否为有意义的翻译文本
 */
const isMeaningfulTrans = (text: string): boolean =>
  !!text && text !== "//" && !text.includes("作品的著作权");

/**
 * 将翻译/音译歌词按时间戳对齐到主歌词行
 * @param lines - 主歌词行数组（原地修改）
 * @param transLines - 已解析的翻译/音译歌词行
 * @param field - 写入目标字段名称
 * @returns 无返回值（原地修改）
 */
export const pairTranslation = (
  lines: LyricLine[],
  transLines: LyricLine[],
  field: "translatedLyric" | "romanLyric",
): void => {
  const trans = [...transLines].sort((a, b) => a.startTime - b.startTime);
  let i = 0;
  let j = 0;
  while (i < lines.length && j < trans.length) {
    const diff = lines[i].startTime - trans[j].startTime;
    if (Math.abs(diff) <= ALIGN_TOLERANCE_MS) {
      const text = lineText(trans[j]);
      if (isMeaningfulTrans(text)) lines[i][field] = text;
      i++;
      j++;
    } else if (diff < 0) {
      i++;
    } else {
      j++;
    }
  }
};

/**
 * 解析歌词主入口函数
 * @param input - 歌词输入载荷（纯字符串或 LyricInput 对象）
 * @param format - 可选显式格式（默认自动嗅探）
 * @param options - 解析配置选项
 * @returns 标准化歌词行数组
 */
export const parseLyric = (
  input: string | LyricInput,
  format?: LyricFormat,
  options: ParseLyricOptions = {},
): LyricLine[] => {
  const payload: LyricInput = typeof input === "string" ? { content: input } : input;
  const actualFormat = format || detectFormat(payload.content);

  const lines = parseContent(normalizeKangxi(payload.content), actualFormat, options);

  if (payload.translation) {
    const transFormat = payload.translationFormat || detectFormat(payload.translation);
    pairTranslation(
      lines,
      parseContent(normalizeKangxi(payload.translation), transFormat, options),
      "translatedLyric",
    );
  }

  if (payload.romaji) {
    const romajiFormat = payload.romajiFormat || detectFormat(payload.romaji);
    pairTranslation(
      lines,
      parseContent(normalizeKangxi(payload.romaji), romajiFormat, options),
      "romanLyric",
    );
  }

  return lines;
};
