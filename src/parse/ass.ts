import type { LyricLine, LyricWord } from "../types";

/** 匹配 Dialogue 行各字段 */
const DIALOGUE_RE = /^Dialogue:\s*\d+,(\d+:\d{2}:\d{2}\.\d{2}),(\d+:\d{2}:\d{2}\.\d{2}),([^,]*),/;

/** 匹配卡拉OK 标签 {\kf<n>} / {\k<n>} / {\K<n>} */
const KARAOKE_RE = /\{\\[kK]f?(\d+)\}([^{]*)/g;

/** 匹配所有 ASS 标签 {\xxx} */
const ASS_TAG_RE = /\{[^}]*\}/g;

/**
 * 解析 ASS 时间戳为毫秒
 * 格式：H:MM:SS.cc（厘秒）
 */
const parseAssTime = (value: string): number => {
  const parts = value.split(":");
  if (parts.length < 3) return 0;
  const hr = parseInt(parts[0], 10);
  const min = parseInt(parts[1], 10);
  const secParts = parts[2].split(".");
  const sec = parseInt(secParts[0], 10);
  const cs = parseInt(secParts[1] ?? "0", 10);
  return ((hr * 60 + min) * 60 + sec) * 1000 + cs * 10;
};

/**
 * 从文本中解析卡拉OK 逐字标签为单词数组
 */
const parseKaraokeWords = (text: string, lineStart: number): LyricWord[] | null => {
  KARAOKE_RE.lastIndex = 0;
  const words: LyricWord[] = [];
  let cursor = lineStart;
  let match: RegExpExecArray | null;

  while ((match = KARAOKE_RE.exec(text)) !== null) {
    const durationCs = parseInt(match[1], 10);
    const word = match[2];
    if (!word && durationCs === 0) continue;

    const startTime = cursor;
    const endTime = cursor + durationCs * 10;
    if (word) {
      words.push({ startTime, endTime, word });
    }
    cursor = endTime;
  }

  return words.length > 0 ? words : null;
};

const stripAssTags = (text: string): string => text.replace(ASS_TAG_RE, "");

interface DialogueLine {
  startTime: number;
  endTime: number;
  style: string;
  text: string;
}

/**
 * 解析 ASS 字幕文本
 * 支持 {\kf} 卡拉OK 逐字标签与多 Style（orig, ts, roma）合并
 * @param text ASS 文本内容
 * @returns 解析后的歌词行数组
 */
export const parseASS = (text: string): LyricLine[] => {
  const dialogues: DialogueLine[] = [];
  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    const match = DIALOGUE_RE.exec(trimmed);
    if (!match) continue;

    const parts = trimmed.split(",");
    const dialogueText = parts.slice(9).join(",");
    dialogues.push({
      startTime: parseAssTime(match[1]),
      endTime: parseAssTime(match[2]),
      style: match[3].trim().toLowerCase(),
      text: dialogueText,
    });
  }

  const groups = new Map<string, { orig?: DialogueLine; ts?: DialogueLine; roma?: DialogueLine }>();
  for (const d of dialogues) {
    const key = `${d.startTime}-${d.endTime}`;
    const group = groups.get(key) ?? {};
    if (d.style === "orig" || d.style === "default") {
      group.orig = d;
    } else if (d.style === "ts" || d.style === "translate" || d.style === "translation") {
      group.ts = d;
    } else if (d.style === "roma" || d.style === "roman" || d.style === "romaji") {
      group.roma = d;
    } else if (!group.orig) {
      group.orig = d;
    }
    groups.set(key, group);
  }

  const lines: LyricLine[] = [];
  for (const group of groups.values()) {
    const source = group.orig;
    if (!source) continue;

    const karaokeWords = parseKaraokeWords(source.text, source.startTime);
    const words: LyricWord[] = karaokeWords ?? [
      { startTime: source.startTime, endTime: source.endTime, word: stripAssTags(source.text) },
    ];

    const translatedLyric = group.ts ? stripAssTags(group.ts.text).trim() : "";
    const romanLyric = group.roma ? stripAssTags(group.roma.text).trim() : "";

    lines.push({
      words,
      translatedLyric,
      romanLyric,
      startTime: source.startTime,
      endTime: source.endTime,
      isBG: false,
      isDuet: false,
    });
  }

  lines.sort((a, b) => a.startTime - b.startTime);
  return lines;
};
