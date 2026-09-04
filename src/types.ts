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
  /** 注音（如日语假名、拼音标注） */
  ruby?: LyricSpan[];
  /**
   * 该音节结尾是否紧跟空格（用于西文/英文排版与卡拉OK渲染）
   * 单词本身保持纯净（trim），由该属性控制词间空格
   */
  endsWithSpace?: boolean;
  /** 空拍数量（用于前奏/间奏打拍动效） */
  emptyBeat?: number;
}

/** 一行歌词 */
export interface LyricLine {
  /** 行唯一标识符，如 "L1", "L2" */
  id?: string;
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
  /** 是否为对唱歌词行（右对齐） */
  isDuet: boolean;
  /** 演唱者 ID，如 "v1", "v2" */
  agentId?: string;
  /** 歌曲结构分段（如 "Intro", "Verse", "Chorus", "Bridge", "Outro"） */
  songPart?: string;
  /** 所属结构块索引 */
  blockIndex?: number;
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

/** 演唱者/声部信息 */
export interface TTMLAgent {
  /** 演唱者 ID，如 "v1", "v2" */
  id: string;
  /** 演唱者名称 */
  name?: string;
  /** 类型："person" | "group" | "other" */
  type?: string;
}

/** 音乐平台 ID 键 */
export type TTMLPlatformId = "ncmMusicId" | "qqMusicId" | "spotifyId" | "appleMusicId" | string;

/** TTML 歌词元数据信息 */
export interface TTMLMetadata {
  /** 歌词主语言代码 (BCP-47) */
  language?: string;
  /** 计时模式 */
  timingMode?: "Word" | "Line";
  /** 歌曲标题 */
  title?: string[];
  /** 歌手/艺人列表 */
  artist?: string[];
  /** 专辑名称 */
  album?: string[];
  /** 国际标准录音制品代码 (ISRC) */
  isrc?: string[];
  /** 词曲作者 */
  songwriters?: string[];
  /** 歌词制作者 ID/链接 */
  authorIds?: string[];
  /** 歌词制作者名称/账号 */
  authorNames?: string[];
  /** 演唱者表（id 映射） */
  agents?: Record<string, TTMLAgent>;
  /** 各音乐平台对应歌曲 ID 映射 */
  platformIds?: Record<TTMLPlatformId, string[]>;
  /** 其他自定义/未分类属性 */
  rawProperties?: Record<string, string[]>;
}

/** TTML 完整解析结果（包含元数据） */
export interface TTMLResult {
  /** 解析出的歌词行列表 */
  lines: LyricLine[];
  /** 歌曲与制作元数据 */
  metadata: TTMLMetadata;
}

/** DOMParser 兼容接口（适用于浏览器 DOMParser 或 Node 端 xmldom / jsdom / happy-dom） */
export interface DOMParserLike {
  parseFromString: (text: string, type: DOMParserSupportedType) => Document;
}

export type DOMParserConstructor = new () => DOMParserLike;

/** 解析歌词的通用配置选项 */
export interface ParseLyricOptions {
  /** 是否检测括号提取背景歌词行，默认为 true */
  detectBackground?: boolean;
  /** 偏好翻译语言标签（如 zh-CN），用于 TTML 等内嵌多语言翻译 */
  preferredLang?: string;
  /** 是否返回完整包含 metadata 的结果对象（仅对支持元数据的格式如 TTML 生效） */
  full?: boolean;
  /** 可选注入的 XML DOMParser（在纯 Node 环境解析 TTML 时使用） */
  domParser?: DOMParserLike | DOMParserConstructor;
}

/** 解析 TTML 歌词的配置选项 */
export interface ParseTTMLOptions extends ParseLyricOptions {
  /** 是否返回完整结果（包含歌词行与元数据） */
  full?: boolean;
}

/** TTML 解析函数重载签名接口 */
export interface ParseTTMLFunction {
  (text: string, options: ParseTTMLOptions & { full: true }): TTMLResult;
  (text: string, options?: (ParseTTMLOptions & { full?: false }) | string): LyricLine[];
  (text: string, options?: ParseTTMLOptions | string): LyricLine[] | TTMLResult;
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
