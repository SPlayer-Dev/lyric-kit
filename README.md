# lyric-kit

A TypeScript library for parsing, serializing, and synchronizing lyrics across formats (LRC, TTML, QRC, KRC, YRC, LyS, SRT, ASS).

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](#)
[![Zero Dependency](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)

English | [简体中文](README.zh-CN.md)

## Installation

```bash
pnpm add lyric-kit
# or
npm install lyric-kit
```

## Quick Start

### Parse Lyrics

`parseLyric` accepts raw lyric text or an object payload with optional translations/romanizations.

```ts
import { parseLyric } from "lyric-kit";

// 1. Parse string (format auto-detected)
const { lines, metadata } = parseLyric(`
[ti:Song Title]
[ar:Artist Name]
[00:01.00]First line
[00:03.00]Second line
`);

// 2. Parse with translation & romanization alignment
const result = parseLyric({
  content: "[00:01.00]Hello\n[00:03.00]Goodbye",
  translation: "[00:01.00]你好\n[00:03.00]再见",
  romaji: "[00:01.00]haro\n[00:03.00]gubbai",
});
```

### Serialize Lyrics

Export `LyricLine[]` or `LyricResult` into standard lyric formats:

```ts
import { serializeLyric } from "lyric-kit";

// Default target is "lrc"
const lrc = serializeLyric(lines, "lrc");

// Word-by-word enhanced LRC
const elrc = serializeLyric(lines, "elrc");

// Apple Music TTML XML
const ttml = serializeLyric(lines, "ttml");

// SubRip subtitle
const srt = serializeLyric(lines, "srt");
```

### Clean Metadata Headers

Strip credit headers/footers (lyricist, composer, arranger, copyright notices):

```ts
import { stripLyricMetadata } from "lyric-kit";

const cleanedLines = stripLyricMetadata(lines, {
  matchMetadata: {
    title: "Song Title",
    artists: ["Artist Name"],
  },
});
```

### Playback Synchronization

```ts
import { findLyricIndex, getWordSweepProgress } from "lyric-kit";

// Find current active line by playback time (ms)
const currentMs = 1500;
const lineIndex = findLyricIndex(lines, currentMs);

if (lineIndex !== -1) {
  const activeLine = lines[lineIndex];

  // Calculate karaoke highlight progress [0, 1] per syllable/word
  for (const word of activeLine.words) {
    const progress = getWordSweepProgress(word, activeLine.startTime, currentMs);
  }
}
```

---

## API Reference

### `parseLyric(input, options?)`

Parses lyrics and returns a `LyricResult`.

- **`input`**: `string | LyricInput`
  - `content`: Primary lyric string.
  - `format?`: Optional format override.
  - `translation?`: Optional translation string.
  - `translationFormat?`: Optional translation format override.
  - `romaji?`: Optional romanization string.
  - `romajiFormat?`: Optional romanization format override.
- **`options`**: `ParseOptions` (optional)

#### `ParseOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `format` | `LyricFormat` | auto | Explicit format override (`lrc`, `ttml`, `qrc`, `krc`, `yrc`, `lys`, `srt`, `ass`). |
| `detectBackground` | `boolean` | `false` | Detect and split parenthesized background/harmony vocals. |
| `extractMetadata` | `boolean` | `false` | Extract song metadata (title, artist, album, creators, offset). |
| `cleanKangxi` | `boolean` | `false` | Normalize KangXi radicals and CJK compatibility ideographs to standard characters. |
| `preferredLang` | `string` | `""` | Preferred translation language code for multi-track TTML (e.g. `"zh-CN"`). |
| `domParser` | `DOMParserLike` | auto | Custom DOMParser instance/constructor (required in non-browser/Node.js environments when parsing TTML or QRC XML). |

### Format Parsers

Individual format parsers can be called directly:

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

Inspects raw text patterns and returns the detected format:
`"lrc" | "ttml" | "qrc" | "krc" | "yrc" | "lys" | "srt" | "ass"`.

### Data Models

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
  startTime: number; // ms
  endTime: number;   // ms
  isBG: boolean;
  isDuet: boolean;
  agentId?: string;
  songPart?: string;
  blockIndex?: number;
}

interface LyricWord {
  word: string;
  startTime: number; // ms
  endTime: number;   // ms
  romanWord?: string;
  obscene?: boolean;
  ruby?: LyricSpan[];
  endsWithSpace?: boolean;
  emptyBeat?: number;
}
```

## License

[AGPL-3.0](LICENSE)
