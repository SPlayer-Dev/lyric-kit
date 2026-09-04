/** 歌词格式 */
export type LyricFormat = "ttml" | "lys" | "yrc" | "qrc" | "krc" | "lrc" | "srt" | "ass";

/** 默认格式优先级（高到低） */
export const DEFAULT_LYRIC_FORMAT_ORDER: readonly LyricFormat[] = [
  "ttml",
  "lys",
  "qrc",
  "krc",
  "yrc",
  "lrc",
  "ass",
  "srt",
];

/** 歌词来源 */
export type LyricSource = "external" | "embedded" | "online";

/** 歌词行语言；und-Latn 表示语言未知的拉丁文字 */
export type LyricLanguage = "ja" | "ko" | "zh-CN" | "und-Latn";

/** 歌词时间片段 */
export interface LyricSpan {
  /** 起始时间（毫秒） */
  startTime: number;
  /** 结束时间（毫秒） */
  endTime: number;
  /** 内容 */
  word: string;
}

/** 歌词单词（逐字片段） */
export interface LyricWord extends LyricSpan {
  /** 音译内容 */
  romanWord?: string;
  /** 是否包含不雅用语 */
  obscene?: boolean;
  /** 注音（如日语假名标注） */
  ruby?: LyricSpan[];
}

/** 一行歌词 */
export interface LyricLine {
  /** 主歌词语言，用于字形选择与 HTML lang */
  language?: LyricLanguage;
  /** 该行的所有单词/逐字片段 */
  words: LyricWord[];
  /** 该行的翻译歌词 */
  translatedLyric: string;
  /** 该行的音译歌词 */
  romanLyric: string;
  /** 句子的起始时间，单位为毫秒 */
  startTime: number;
  /** 句子的结束时间，单位为毫秒 */
  endTime: number;
  /** 是否为背景歌词行 */
  isBG: boolean;
  /** 是否为对唱歌词行 */
  isDuet: boolean;
}

/**
 * 歌词原始内容载荷：主 + 可选翻译 / 音译
 */
export interface LyricInput {
  /** 主歌词原始文本 */
  content: string;
  /** 翻译原始文本 */
  translation?: string;
  translationFormat?: LyricFormat;
  /** 罗马音原始文本 */
  romaji?: string;
  romajiFormat?: LyricFormat;
}

/** 解析歌词的配置选项 */
export interface ParseLyricOptions {
  /** 是否检测括号提取背景歌词行，默认为 true */
  detectBackground?: boolean;
  /** 偏好翻译语言标签（如 zh-CN），用于 TTML 等内嵌多语言翻译 */
  preferredLang?: string;
  /** 可选注入的 XML DOMParser（在纯 Node 环境解析 TTML 时使用） */
  domParser?: {
    parseFromString: (text: string, type: string) => Document;
  };
}

/** 元数据行清理配置选项 */
export interface StripOptions {
  /** 关键词列表 */
  keywords?: string[];
  /** 正则字符串列表 */
  regexPatterns?: string[];
  /** 弱匹配正则列表 */
  softMatchRegexes?: string[];
  /** 歌曲元信息，用于检查首行「歌曲 - 歌手」模式 */
  matchMetadata?: {
    title?: string;
    artists?: string[];
  };
}

/** 序列化导出支持的目标格式 */
export type SerializeLyricFormat = "lrc" | "elrc" | "ttml" | "srt";
