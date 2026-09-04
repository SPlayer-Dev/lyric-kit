import type { LyricLine } from "../types";

/** 匹配 SRT 时间戳 HH:MM:SS,mmm */
const TIME_RE = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

/**
 * 解析 SRT 时间戳为毫秒数
 * @param value - SRT 格式时间字符串（如 "01:23:45,678"）
 * @returns 对应毫秒数
 */
const parseSrtTime = (value: string): number => {
  const m = TIME_RE.exec(value);
  if (!m) return 0;
  const hr = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = parseInt(m[3], 10);
  let ms = parseInt(m[4], 10);
  if (m[4].length === 1) ms *= 100;
  else if (m[4].length === 2) ms *= 10;
  return ((hr * 60 + min) * 60 + sec) * 1000 + ms;
};

/**
 * 解析 SRT 字幕文本
 * @param text - SRT 文本内容
 * @returns 解析后的歌词行数组
 */
export const parseSRT = (text: string): LyricLine[] => {
  const lines: LyricLine[] = [];
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\n+/);

  for (const block of blocks) {
    const parts = block.trim().split("\n");
    if (parts.length < 3) continue;

    if (!/^\d+$/.test(parts[0].trim())) continue;

    const timeLine = parts[1];
    const arrowIdx = timeLine.indexOf("-->");
    if (arrowIdx === -1) continue;

    const startTime = parseSrtTime(timeLine.slice(0, arrowIdx));
    const endTime = parseSrtTime(timeLine.slice(arrowIdx + 3));

    const textLines = parts
      .slice(2)
      .filter((l) => l.trim())
      .map((l) => l.trim());
    if (textLines.length === 0) continue;

    const count = textLines.length;
    const mainText = textLines[count - 1];
    const translatedLyric = count >= 2 ? textLines[count - 2] : "";
    const romanLyric = count >= 3 ? textLines[count - 3] : "";

    lines.push({
      words: [{ startTime, endTime, word: mainText }],
      translatedLyric,
      romanLyric,
      startTime,
      endTime,
      isBG: false,
      isDuet: false,
    });
  }

  return lines;
};
