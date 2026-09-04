import type { LyricLine } from "../types";
import { formatSrtTime } from "../utils/timestamp";

const lineMainText = (line: LyricLine): string =>
  line.words
    .map((word) => word.word)
    .join("")
    .trim();

/**
 * 将歌词行序列化为 SRT 字幕文本
 * @param lines 歌词行数组
 * @returns SRT 格式字符串
 */
export const toSrt = (lines: LyricLine[]): string => {
  const blocks: string[] = [];
  let index = 1;

  for (const line of lines) {
    const text = lineMainText(line);
    if (!text) continue;

    const timeHeader = `${formatSrtTime(line.startTime)} --> ${formatSrtTime(line.endTime)}`;
    const textRows: string[] = [];

    if (line.romanLyric) textRows.push(line.romanLyric);
    if (line.translatedLyric) textRows.push(line.translatedLyric);
    textRows.push(text);

    blocks.push(`${index++}\n${timeHeader}\n${textRows.join("\n")}`);
  }

  return blocks.join("\n\n");
};
