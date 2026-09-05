/** 歌词格式 */
export type LyricFormat = "ttml" | "lys" | "yrc" | "qrc" | "krc" | "lrc" | "srt" | "ass";

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
  /** 内容纯文本 */
  word: string;
}

/** 歌词单词（逐字片段） */
export interface LyricWord extends LyricSpan {
  /** 音译内容 */
  romanWord?: string;
  /**
   * 是否包含不雅用语
   * @default false
   */
  obscene?: boolean;
  /** 注音列表（如日语假名、拼音标注） */
  ruby?: LyricSpan[];
  /**
   * 该音节结尾是否紧跟空格（用于西文/英文排版与卡拉OK渲染）
   * 单词本身保持纯净（trim），由该属性控制词间空格
   * @default false
   */
  endsWithSpace?: boolean;
  /**
   * 空拍数量（用于前奏/间奏打拍动效）
   * @default 0
   */
  emptyBeat?: number;
}

/** 一行歌词 */
export interface LyricLine {
  /** 行唯一标识符，如 "L1", "L2" */
  id?: string;
  /** 主歌词语言，用于字形选择与 HTML lang 属性 */
  language?: LyricLanguage;
  /** 该行的所有单词/逐字片段序列 */
  words: LyricWord[];
  /** 该行的翻译歌词内容 */
  translatedLyric: string;
  /** 该行的音译歌词内容 */
  romanLyric: string;
  /** 句子的起始时间（毫秒） */
  startTime: number;
  /** 句子的结束时间（毫秒） */
  endTime: number;
  /**
   * 是否为背景歌词行
   * @default false
   */
  isBG: boolean;
  /**
   * 是否为对唱歌词行（右对齐）
   * @default false
   */
  isDuet: boolean;
  /** 演唱者 ID，如 "v1", "v2" */
  agentId?: string;
  /** 歌曲结构分段标签（如 "Intro", "Verse", "Chorus", "Bridge", "Outro"） */
  songPart?: string;
  /** 所属结构块索引 */
  blockIndex?: number;
}

/** 歌词原始内容载荷：主歌词 + 可选翻译 / 音译 */
export interface LyricInput {
  /** 主歌词原始文本 */
  content: string;
  /** 主歌词格式（省略时自动探测） */
  format?: LyricFormat;
  /** 翻译原始文本 */
  translation?: string;
  /** 翻译歌词格式（省略时自动探测） */
  translationFormat?: LyricFormat;
  /** 罗马音原始文本 */
  romaji?: string;
  /** 罗马音歌词格式（省略时自动探测） */
  romajiFormat?: LyricFormat;
}

/** 演唱者/声部信息 */
export interface TTMLAgent {
  /** 演唱者 ID，如 "v1", "v2" */
  id: string;
  /** 演唱者名称 */
  name?: string;
  /**
   * 实体类型
   * @example "person" | "group" | "other"
   */
  type?: string;
}

/** 音乐平台 ID 键 */
export type TTMLPlatformId = "ncmMusicId" | "qqMusicId" | "spotifyId" | "appleMusicId" | string;

/** 通用歌词元数据信息 */
export interface LyricMetadata {
  /** 歌词主语言代码 (BCP-47) */
  language?: string;
  /** 计时模式（Word 逐字或 Line 逐行） */
  timingMode?: "Word" | "Line";
  /** 歌曲标题 */
  title?: string[];
  /** 歌手/艺人列表 */
  artist?: string[];
  /** 专辑名称 */
  album?: string[];
  /** 国际标准录音制品代码 (ISRC) */
  isrc?: string[];
  /** 词曲作者/编曲列表 */
  songwriters?: string[];
  /** 歌词制作者/LRC by/Author 列表 */
  authors?: string[];
  /** 歌词制作者 ID/链接列表 */
  authorIds?: string[];
  /** 歌词制作者名称/账号列表 */
  authorNames?: string[];
  /**
   * 整体时间偏移量（毫秒，如 LRC [offset:+500]）
   * @default 0
   */
  offset?: number;
  /** 演唱者/声部表映射（如 v1, v2） */
  agents?: Record<string, TTMLAgent>;
  /** 各音乐平台对应歌曲 ID 映射 */
  platformIds?: Record<TTMLPlatformId, string[]>;
  /** 其他自定义/未分类属性标签集合 */
  rawProperties?: Record<string, string[]>;
}

/** 统一歌词解析结果 */
export interface LyricResult {
  /** 解析出的歌词行列表 */
  lines: LyricLine[];
  /** 歌曲元数据 */
  metadata: LyricMetadata;
}

/** DOMParser 兼容接口（适用于浏览器原生 DOMParser 或 Node 端 xmldom / jsdom / happy-dom） */
export interface DOMParserLike {
  parseFromString: (text: string, type: DOMParserSupportedType) => Document;
}

export type DOMParserConstructor = new () => DOMParserLike;

/** 统一歌词解析配置选项 */
export interface ParseOptions {
  /**
   * 指定歌词格式
   * 若省略则根据歌词文本特征自动探测
   */
  format?: LyricFormat;

  /**
   * 是否通过括号启发式检测提取背景歌词行
   * @default false
   */
  detectBackground?: boolean;

  /**
   * 是否提取元数据（标题、歌手、专辑、制作人等）
   * @default false
   */
  extractMetadata?: boolean;

  /**
   * 是否清洗康熙部首及兼容表意文字还原为标准汉字
   * @default false
   */
  cleanKangxi?: boolean;

  /**
   * 偏好翻译语言标签，用于 TTML 等格式挑选多语言轨道
   * @example "zh-CN"
   */
  preferredLang?: string;

  /** 自定义注入的 XML DOMParser（在纯 Node.js 环境解析 TTML 或 QRC XML 时使用） */
  domParser?: DOMParserLike | DOMParserConstructor;
}

/** 元数据行清理配置选项 */
export interface StripOptions {
  /**
   * 自定义关键词列表
   * 若省略则使用库内置的 defaultKeywords 规则
   */
  keywords?: string[];

  /**
   * 自定义正则字符串列表
   * 若省略则使用库内置的 defaultRegexes 规则
   */
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
