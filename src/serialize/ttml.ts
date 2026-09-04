import type { LyricLine, LyricWord } from "../types";
import { formatTtmlTime } from "../utils/timestamp";

/**
 * 转义 XML 特殊字符
 * @param text - 原始字符串
 * @returns 转义后的 XML 安全字符串
 */
const escapeXml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * 将单个单词生成为带有时间与属性的 span 节点字符串
 * @param word - 歌词单词对象
 * @returns span 节点 XML 字符串
 */
const singleWordSpan = (word: LyricWord): string => {
  const obsceneAttr = word.obscene ? ' amll:obscene="true"' : "";
  const emptyBeatAttr = word.emptyBeat !== undefined ? ` amll:empty-beat="${word.emptyBeat}"` : "";
  const trailingSpace = word.endsWithSpace ? " " : "";

  if (word.ruby && word.ruby.length > 0) {
    const rubySpans = word.ruby
      .map(
        (r) =>
          `<span tts:ruby="text" begin="${formatTtmlTime(r.startTime)}" end="${formatTtmlTime(r.endTime)}">${escapeXml(r.word)}</span>`,
      )
      .join("");

    return `<span tts:ruby="container"${obsceneAttr}${emptyBeatAttr}><span tts:ruby="base">${escapeXml(word.word)}</span><span tts:ruby="textContainer">${rubySpans}</span></span>${trailingSpace}`;
  }

  return `<span begin="${formatTtmlTime(word.startTime)}" end="${formatTtmlTime(word.endTime)}"${obsceneAttr}${emptyBeatAttr}>${escapeXml(word.word)}</span>${trailingSpace}`;
};

/**
 * 将歌词行中的所有单词拼接为 span 序列
 * @param line - 歌词行对象
 * @returns 拼接后的 span 字符串
 */
const wordSpans = (line: LyricLine): string => line.words.map(singleWordSpan).join("");

/**
 * 生成包含角色的辅助 span 节点（如翻译或音译）
 * @param role - 角色标识符（如 x-translation 或 x-roman）
 * @param text - 文本内容
 * @returns 角色 span XML 字符串
 */
const roleSpan = (role: string, text: string): string =>
  text ? `<span ttm:role="${role}">${escapeXml(text)}</span>` : "";

/**
 * 将背景人声歌词行序列化为嵌套 span 节点
 * @param bg - 背景歌词行对象
 * @returns 嵌套的背景音 XML 字符串
 */
const bgSpan = (bg: LyricLine): string =>
  `<span ttm:role="x-bg">${wordSpans(bg)}${roleSpan("x-translation", bg.translatedLyric)}${roleSpan("x-roman", bg.romanLyric)}</span>`;

/**
 * 将主歌词行及其背景音序列化为 p 节点
 * @param main - 主歌词行对象
 * @param bgs - 关联的背景歌词行列表
 * @returns 完整的 p 节点 XML 字符串
 */
const paragraph = (main: LyricLine, bgs: LyricLine[]): string => {
  const agent = main.isDuet
    ? ' ttm:agent="v2"'
    : main.agentId
      ? ` ttm:agent="${escapeXml(main.agentId)}"`
      : "";
  const keyAttr = main.id ? ` itunes:key="${escapeXml(main.id)}"` : "";
  const inner =
    wordSpans(main) +
    roleSpan("x-translation", main.translatedLyric) +
    roleSpan("x-roman", main.romanLyric) +
    bgs.map(bgSpan).join("");
  return `<p begin="${formatTtmlTime(main.startTime)}" end="${formatTtmlTime(main.endTime)}"${keyAttr}${agent}>${inner}</p>`;
};

/**
 * 将歌词行序列化为标准 TTML XML
 * @param lines - 歌词行数组
 * @returns TTML XML 字符串
 */
export const toTtml = (lines: LyricLine[]): string => {
  const groups: { main: LyricLine; bg: LyricLine[] }[] = [];
  for (const line of lines) {
    if (line.isBG && groups.length) groups[groups.length - 1].bg.push(line);
    else groups.push({ main: line, bg: [] });
  }

  // 按 songPart 分组包裹 <div>
  const divBlocks: string[] = [];
  let currentPart: string | undefined;
  let currentLines: string[] = [];

  /**
   * 将当前累积的段落行刷新为包含歌曲分段的 div 块
   * @returns 无返回值
   */
  const flushDiv = (): void => {
    if (currentLines.length === 0) return;
    const partAttr = currentPart ? ` itunes:song-part="${escapeXml(currentPart)}"` : "";
    divBlocks.push(`    <div${partAttr}>\n${currentLines.join("\n")}\n    </div>`);
    currentLines = [];
  };

  for (const group of groups) {
    if (group.main.songPart !== currentPart) {
      flushDiv();
      currentPart = group.main.songPart;
    }
    currentLines.push(`      ${paragraph(group.main, group.bg)}`);
  }
  flushDiv();

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:amll="http://www.example.com/ns/amll">',
    "  <body>",
    divBlocks.join("\n"),
    "  </body>",
    "</tt>",
  ].join("\n");
};
