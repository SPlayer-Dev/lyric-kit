# lyric-kit

> A lightweight, zero-dependency toolkit for parsing, serializing, and processing lyrics across multiple formats.

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](#)
[![Zero Dependency](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)

## ✨ 特性 (Features)

- 🚀 **零运行时依赖 (Zero Dependencies)**：体积小巧轻量，纯 TypeScript 原生实现，兼容 Node.js、Bun、Deno、浏览器及 Electron 环境。
- 🎵 **丰富格式支持 (Multi-format Support)**：
  - **LRC**：标准逐行、多时间戳展开、ESLRC 尖括号逐字 `<mm:ss.xx>`、中括号逐字 `[mm:ss.xx]`
  - **TTML**：Apple Music / AMLL 逐字歌词、对唱识别、背景音 `role="x-bg"`、iTunes 多语言翻译与注音音译
  - **QRC**：QQ 音乐逐字（纯文本与 XML 包裹格式）
  - **YRC**：网易云音乐逐字格式
  - **KRC**：酷狗音乐逐字格式
  - **LyS**：Lyricify Syllable 格式
  - **SRT** / **ASS**：影视与卡拉OK字幕格式（含 `\kf` 逐字解析）
- 🔄 **双向转换与序列化 (Serialization)**：支持将标准 `LyricLine[]` 结构导出为标准 LRC、逐字增强型 LRC (A2)、TTML XML 或 SRT 字幕。
- 🧹 **智能元数据清理 (Metadata Stripper)**：自动识别并剔除片头片尾的词/曲/编曲/制作人员/版权声明，支持白名单与首行匹配。
- ⏱️ **毫秒级同步查找 (Playback Synchronization)**：
  - 二分查找当前播放行 (`findLyricIndex`)
  - 多行并发活跃区间检测 (`findActiveLyricIndices`)
  - 卡拉OK逐字平滑扫亮进度计算 (`getWordSweepProgress`，内置 preRoll 衔接平滑算法)
- 🌐 **语种检测与归一化 (Language & Normalize)**：
  - 启发式检测歌词行语言（日语 `ja`、韩语 `ko`、中文 `zh-CN`、拉丁文字 `und-Latn`）
  - 康熙部首与兼容表意文字归一化 (`normalizeKangxi`)
  - 时间戳连续性修正与微小重叠消除 (`normalizeLyricLines`)

---

## 📦 安装 (Installation)

```bash
pnpm add lyric-kit
# 或
npm install lyric-kit
# 或
yarn add lyric-kit
```

---

## 🛠️ 使用示例 (Usage)

### 1. 自动检测并解析歌词 (Parse Lyrics)

```typescript
import { parseLyric, detectFormat } from "lyric-kit";

// 自动探测格式并解析
const lrcText = `
[00:01.00]第一句歌词
[00:03.00]第二句歌词
`;
const lines = parseLyric(lrcText);
console.log(lines);

// 支持带双语翻译与罗马音对齐
const bilingualLines = parseLyric({
  content: "[00:01.00]Hello\n[00:03.00]Goodbye",
  translation: "[00:01.00]你好\n[00:03.00]再见",
  romaji: "[00:01.00]haro\n[00:03.00]gubbai",
});
```

### 2. 导出序列化 (Serialize)

```typescript
import { serializeLyric, toLrc, toTtml, toEnhancedLrc } from "lyric-kit";

// 导出为标准 LRC
const lrc = serializeLyric(lines, "lrc");

// 导出为逐字增强型 LRC
const elrc = serializeLyric(lines, "elrc");

// 导出为 Apple Music TTML
const ttml = serializeLyric(lines, "ttml");
```

### 3. 剥离元数据制作行 (Strip Metadata)

```typescript
import { stripLyricMetadata } from "lyric-kit";

// 自动剔除开头的「作词: xxx」「作曲: xxx」以及结尾的版权声明
const cleanLines = stripLyricMetadata(lines, {
  matchMetadata: {
    title: "歌曲名称",
    artists: ["歌手名称"],
  },
});
```

### 4. 播放时间同步与卡拉OK扫字 (Sync & Karaoke)

```typescript
import { findLyricIndex, getWordSweepProgress } from "lyric-kit";

// 在 60fps / requestAnimationFrame 循环中：
const currentMs = 1500;
const activeLineIndex = findLyricIndex(lines, currentMs);

if (activeLineIndex !== -1) {
  const line = lines[activeLineIndex];
  for (const word of line.words) {
    // 获取当前字的平滑扫亮进度 [0, 1]
    const progress = getWordSweepProgress(word, line.startTime, currentMs);
    console.log(word.word, progress);
  }
}
```

---

## 📄 开源许可 (License)

[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)
