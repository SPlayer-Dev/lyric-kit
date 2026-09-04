import type { LyricLine } from "../types";
import { formatTtmlTime } from "../utils/timestamp";

const escapeXml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const wordSpans = (line: LyricLine): string =>
  line.words
    .map(
      (word) =>
        `<span begin="${formatTtmlTime(word.startTime)}" end="${formatTtmlTime(word.endTime)}">${escapeXml(word.word)}</span>`,
    )
    .join("");

const roleSpan = (role: string, text: string): string =>
  text ? `<span ttm:role="${role}">${escapeXml(text)}</span>` : "";

const bgSpan = (bg: LyricLine): string =>
  `<span ttm:role="x-bg">${wordSpans(bg)}${roleSpan("x-translation", bg.translatedLyric)}${roleSpan("x-roman", bg.romanLyric)}</span>`;

const paragraph = (main: LyricLine, bgs: LyricLine[]): string => {
  const agent = main.isDuet ? ' ttm:agent="v2"' : "";
  const inner =
    wordSpans(main) +
    roleSpan("x-translation", main.translatedLyric) +
    roleSpan("x-roman", main.romanLyric) +
    bgs.map(bgSpan).join("");
  return `<p begin="${formatTtmlTime(main.startTime)}" end="${formatTtmlTime(main.endTime)}"${agent}>${inner}</p>`;
};

/**
 * 将歌词行序列化为标准 TTML XML
 * 完整保留逐字时间、翻译、音译、对唱标记与背景音行嵌套结构
 * @param lines 歌词行数组
 * @returns TTML XML 字符串
 */
export const toTtml = (lines: LyricLine[]): string => {
  const groups: { main: LyricLine; bg: LyricLine[] }[] = [];
  for (const line of lines) {
    if (line.isBG && groups.length) groups[groups.length - 1].bg.push(line);
    else groups.push({ main: line, bg: [] });
  }
  const body = groups.map((group) => `      ${paragraph(group.main, group.bg)}`).join("\n");
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:amll="http://www.example.com/ns/amll">',
    "  <body>",
    "    <div>",
    body,
    "    </div>",
    "  </body>",
    "</tt>",
  ].join("\n");
};
