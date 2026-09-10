export interface DemoState {
  parse: {
    format: string; // "auto" | LyricFormat
    detectBackground: boolean;
    extractMetadata: boolean;
    cleanKangxi: boolean;
    preferredLang: string;
    applyOffset: boolean;
    multiLineMode: "join" | "bilingual";
    keepEmptyLines: boolean;
    serializeTarget: "lrc" | "elrc" | "ttml" | "srt";
    singleParser: boolean;
  };
  // 各输入轨道的格式（auto = detectFormat 自动探测）
  track: {
    mainFormat: string;
    translationFormat: string;
    romajiFormat: string;
  };
  clean: {
    stripMetadata: boolean;
    useDefaultRules: boolean;
    keywords: string;
    regexPatterns: string;
    matchTitle: string;
    matchArtists: string;
    normalizeLines: boolean;
    applyLanguages: boolean;
  };
}

export const createInitialState = (): DemoState => ({
  parse: {
    format: "auto",
    detectBackground: true,
    extractMetadata: false,
    cleanKangxi: false,
    preferredLang: "",
    applyOffset: false,
    multiLineMode: "join",
    keepEmptyLines: false,
    serializeTarget: "lrc",
    singleParser: false,
  },
  track: {
    mainFormat: "auto",
    translationFormat: "auto",
    romajiFormat: "auto",
  },
  clean: {
    stripMetadata: false,
    useDefaultRules: true,
    keywords: "",
    regexPatterns: "",
    matchTitle: "",
    matchArtists: "",
    normalizeLines: true,
    applyLanguages: false,
  },
});

const splitList = (value: string): string[] =>
  value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

/** 根据面板状态构建 stripLyricMetadata 的 StripOptions；未启用清理时返回 undefined */
export const buildStripOptions = (state: DemoState) => {
  if (!state.clean.stripMetadata) return undefined;
  const options: {
    useDefaultRules: boolean;
    keywords: string[];
    regexPatterns: string[];
    matchMetadata?: { title: string; artists: string[] };
  } = {
    useDefaultRules: state.clean.useDefaultRules,
    keywords: splitList(state.clean.keywords),
    regexPatterns: splitList(state.clean.regexPatterns),
  };
  if (state.clean.matchTitle && state.clean.matchArtists) {
    options.matchMetadata = {
      title: state.clean.matchTitle,
      artists: splitList(state.clean.matchArtists),
    };
  }
  return options;
};
