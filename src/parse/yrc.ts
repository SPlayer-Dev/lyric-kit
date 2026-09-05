import type { LyricLine, LyricMetadata, LyricResult, LyricWord, ParseOptions } from "../types";
import { detectBackgroundLine, splitTrailingBackground } from "../utils/bg";

/** 行头：[起始毫秒, 时长毫秒] */
const LINE_HEADER_RE = /^\[(\d+),(\d+)\]/;

/** 匹配元数据标签（如 [ti:xxx]、[ar:xxx]） */
const META_TAG_RE = /^\[([a-zA-Z]+):(.*?)]$/;

/** 字级时间戳标记：(起始毫秒, 时长毫秒, 0) */
const TIMING_TAG_RE = /\((\d+),(\d+),\d+\)/g;

/**
 * 解析单行 YRC 的逐字时间戳与单词序列
 * @param rest - 行头时间戳之后的行文本内容
 * @returns 逐字单词数组
 */
const parseYrcWords = (rest: string): LyricWord[] => {
  TIMING_TAG_RE.lastIndex = 0;
  const matches: { start: number; dur: number; index: number; length: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = TIMING_TAG_RE.exec(rest)) !== null) {
    matches.push({
      start: parseInt(m[1], 10),
      dur: parseInt(m[2], 10),
      index: m.index,
      length: m[0].length,
    });
  }

  if (matches.length === 0) return [];

  const words: LyricWord[] = [];
  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const textStart = curr.index + curr.length;
    const textEnd = i + 1 < matches.length ? matches[i + 1].index : rest.length;
    const rawWord = rest.slice(textStart, textEnd);

    const startsWithSpace = /^\s/.test(rawWord);
    const endsWithSpace = /\s$/.test(rawWord);
    const cleanWord = rawWord.trim();

    if (startsWithSpace && words.length > 0) {
      words[words.length - 1].endsWithSpace = true;
    }

    if (cleanWord) {
      words.push({
        word: cleanWord,
        startTime: curr.start,
        endTime: curr.start + curr.dur,
        endsWithSpace: endsWithSpace || undefined,
      });
    }
  }

  if (words.length > 0) {
    delete words[words.length - 1].endsWithSpace;
  }

  return words;
};

/**
 * 解析网易云音乐 YRC 逐字歌词
 * @param text - YRC 文本内容
 * @param options - 解析配置选项
 * @returns 歌词解析结果
 */
export const parseYRC = (text: string, options?: ParseOptions): LyricResult => {
  const detectBackground = options?.detectBackground ?? false;
  const extractMetadata = options?.extractMetadata ?? false;

  const metadata: LyricMetadata = extractMetadata ? { timingMode: "Word" } : {};
  const lines: LyricLine[] = [];

  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const jsonStr = trimmed.replace(/^\[\d+,\d+\]/, "");
    if (jsonStr.startsWith('{"t":') || jsonStr.startsWith('{"c":')) {
      if (extractMetadata) {
        try {
          const parsed = JSON.parse(jsonStr) as {
            c?: Array<{ tx?: string }>;
          };
          if (Array.isArray(parsed.c)) {
            for (let idx = 0; idx < parsed.c.length; idx++) {
              const rawTx = parsed.c[idx]?.tx?.trim();
              if (!rawTx) continue;

              const colonIdx = rawTx.indexOf(":");
              const fullColonIdx = colonIdx === -1 ? rawTx.indexOf("：") : colonIdx;

              let role = "";
              let val = "";

              if (fullColonIdx > -1) {
                role = rawTx.slice(0, fullColonIdx).trim();
                val = rawTx.slice(fullColonIdx + 1).trim();
                if (!val && idx + 1 < parsed.c.length) {
                  val = (parsed.c[idx + 1]?.tx || "").trim();
                  idx++;
                }
              }

              if (role && val) {
                if (/^(作词|作曲|编曲|词|曲|Lyricist|Composer|Arranger)/i.test(role)) {
                  if (!metadata.songwriters?.includes(val)) {
                    (metadata.songwriters ??= []).push(val);
                  }
                } else if (/^(歌手|演唱|原唱|Artist|Vocals)/i.test(role)) {
                  if (!metadata.artist?.includes(val)) {
                    (metadata.artist ??= []).push(val);
                  }
                } else if (/^(制作人|监制|出品|统筹|Producer|Publisher)/i.test(role)) {
                  if (!metadata.authors?.includes(val)) {
                    (metadata.authors ??= []).push(val);
                  }
                } else {
                  (metadata.rawProperties ??= {})[role] = [val];
                }
              }
            }
          }
        } catch {
          // 忽略非法 JSON
        }
      }
      continue;
    }

    const metaMatch = META_TAG_RE.exec(trimmed);
    if (metaMatch) {
      if (extractMetadata) {
        const key = metaMatch[1].toLowerCase();
        const val = metaMatch[2].trim();
        if (val) {
          if (key === "ti") metadata.title = [val];
          else if (key === "ar") metadata.artist = [val];
          else if (key === "al") metadata.album = [val];
          else if (key === "by") metadata.authors = [val];
          else if (key === "offset") {
            const off = parseInt(val, 10);
            if (!Number.isNaN(off)) metadata.offset = off;
          } else {
            (metadata.rawProperties ??= {})[key] = [val];
          }
        }
      }
      continue;
    }

    const header = LINE_HEADER_RE.exec(trimmed);
    if (!header) continue;

    const lineStart = parseInt(header[1], 10);
    const lineDur = parseInt(header[2], 10);
    const rest = trimmed.slice(header[0].length);

    const words = parseYrcWords(rest);
    if (words.length === 0) continue;

    const line: LyricLine = {
      words,
      translatedLyric: "",
      romanLyric: "",
      startTime: lineStart,
      endTime: lineStart + lineDur,
      isBG: detectBackgroundLine(words, detectBackground),
      isDuet: false,
    };
    lines.push(line);
    if (!line.isBG) {
      const bg = splitTrailingBackground(line, detectBackground);
      if (bg) lines.push(bg);
    }
  }

  return {
    lines,
    metadata,
  };
};
