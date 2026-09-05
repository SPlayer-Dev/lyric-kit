# lyric-kit

用于解析、序列化及同步多格式歌词（LRC、TTML、QRC、KRC、YRC、LyS、SRT、ASS）的 TypeScript 工具库。

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](#)
[![Zero Dependency](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)

[English](README.md) | 简体中文

## 安装

```bash
pnpm add lyric-kit
# 或
npm install lyric-kit
```

## 快速上手

### 解析歌词

`parseLyric` 支持传入纯歌词文本字符串，或包含翻译/罗马音的配置对象。

```ts
import { parseLyric } from "lyric-kit";

// 1. 传入纯文本（自动检测格式）
const { lines, metadata } = parseLyric(`
[ti:歌曲名]
[ar:歌手名]
[00:01.00]第一行歌词
[00:03.00]第二行歌词
`);

// 2. 传入主歌词、翻译与罗马音（自动时间戳对齐）
const result = parseLyric({
  content: "[00:01.00]Hello\n[00:03.00]Goodbye",
  translation: "[00:01.00]你好\n[00:03.00]再见",
  romaji: "[00:01.00]haro\n[00:03.00]gubbai",
});
```

### 序列化导出

将 `LyricLine[]` 或 `LyricResult` 导出为标准歌词格式：

```ts
import { serializeLyric } from "lyric-kit";

// 默认导出为标准 LRC 格式
const lrc = serializeLyric(lines, "lrc");

// 逐字时间戳增强 LRC 格式
const elrc = serializeLyric(lines, "elrc");

// Apple Music TTML XML 格式
const ttml = serializeLyric(lines, "ttml");

// SubRip 字幕格式
const srt = serializeLyric(lines, "srt");
```

### 清理元数据标头

过滤歌词开头的演职人员信息与版权声明等非歌词文本行：

```ts
import { stripLyricMetadata } from "lyric-kit";

const cleanedLines = stripLyricMetadata(lines, {
  matchMetadata: {
    title: "歌曲名",
    artists: ["歌手名"],
  },
});
```

### 播放同步与卡拉OK进度

```ts
import { findLyricIndex, getWordSweepProgress } from "lyric-kit";

// 根据当前播放时间（毫秒）查找当前激活行
const currentMs = 1500;
const lineIndex = findLyricIndex(lines, currentMs);

if (lineIndex !== -1) {
  const activeLine = lines[lineIndex];

  // 计算每个字/音节的卡拉OK染色进度 [0, 1]
  for (const word of activeLine.words) {
    const progress = getWordSweepProgress(word, activeLine.startTime, currentMs);
  }
}
```

---

## API 参考

### `parseLyric(input, options?)`

解析歌词并返回 `LyricResult`。

- **`input`**: `string | LyricInput`
  - `content`: 主歌词文本。
  - `format?`: 手动指定主歌词格式。
  - `translation?`: 翻译文本。
  - `translationFormat?`: 手动指定翻译格式。
  - `romaji?`: 罗马音文本。
  - `romajiFormat?`: 手动指定罗马音格式。
- **`options`**: `ParseOptions`（可选）

#### `ParseOptions`

| 参数 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `format` | `LyricFormat` | 自动检测 | 手动指定格式（`lrc`、`ttml`、`qrc`、`krc`、`yrc`、`lys`、`srt`、`ass`）。 |
| `detectBackground` | `boolean` | `false` | 是否识别并分离括号内的和声与伴唱（标记为 `isBG`）。 |
| `extractMetadata` | `boolean` | `false` | 是否提取歌曲元数据（歌曲名、歌手、专辑、制作人员、偏移量等）。 |
| `cleanKangxi` | `boolean` | `false` | 是否将康熙部首及 CJK 兼容字符规范化为通用汉字。 |
| `preferredLang` | `string` | `""` | 多轨道 TTML 解析时优先匹配的翻译语言代码（如 `"zh-CN"`）。 |
| `domParser` | `DOMParserLike` | 自动 | 自定义 DOMParser 实例或构造函数（Node.js 等无原生 DOM 环境下解析 TTML / QRC 必填）。 |

### 独立格式解析器

可直接导入并调用各格式的子解析器：

```ts
import {
  parseLRC,
  parseTTML,
  parseQRC,
  parseKRC,
  parseYRC,
  parseLyS,
  parseSRT,
  parseASS,
} from "lyric-kit";

const result = parseLRC(lrcText, { cleanKangxi: true });
```

### `detectFormat(text)`

分析原始文本特征并返回识别出的格式：
`"lrc" | "ttml" | "qrc" | "krc" | "yrc" | "lys" | "srt" | "ass"`。

### 数据模型

```ts
interface LyricResult {
  lines: LyricLine[];
  metadata: LyricMetadata;
}

interface LyricLine {
  id?: string;
  language?: "ja" | "ko" | "zh-CN" | "und-Latn";
  words: LyricWord[];
  translatedLyric: string;
  romanLyric: string;
  startTime: number; // 毫秒 (ms)
  endTime: number;   // 毫秒 (ms)
  isBG: boolean;
  isDuet: boolean;
  agentId?: string;
  songPart?: string;
  blockIndex?: number;
}

interface LyricWord {
  word: string;
  startTime: number; // 毫秒 (ms)
  endTime: number;   // 毫秒 (ms)
  romanWord?: string;
  obscene?: boolean;
  ruby?: LyricSpan[];
  endsWithSpace?: boolean;
  emptyBeat?: number;
}
```

## 开源协议

[AGPL-3.0](LICENSE)
