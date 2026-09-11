import type { LyricLine, LyricWord } from "../types";

/**
 * 将歌词单词序列或歌词行拼接为整行纯文本（全局尊重 endsWithSpace 词尾空格标记并修剪首尾）
 * @param lineOrWords - 歌词行或单词数组
 * @returns 拼接后的整行纯文本
 */
export const getLineText = (lineOrWords: LyricLine | LyricWord[] | null | undefined): string => {
  if (!lineOrWords) return "";
  const words: LyricWord[] = Array.isArray(lineOrWords) ? lineOrWords : lineOrWords.words;
  if (!words || words.length === 0) return "";

  let text = "";
  for (let idx = 0; idx < words.length; idx++) {
    const item = words[idx];
    text += item.word;
    if (item.endsWithSpace) {
      text += " ";
    }
  }
  return text.trim();
};
