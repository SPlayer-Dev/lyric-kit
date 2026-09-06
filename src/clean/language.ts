import type { LyricLine } from "../types";

/** 日语假名：平假名 + 片假名 + 半角假名 + 促音/长音符号 */
const KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}\u30FC\uFF66-\uFF9F]/u;

/** 韩文：谚文音节 + 谚文字母 + 谚文兼容字母 */
const HANGUL_RE = /[\p{Script=Hangul}\u3130-\u318F]/u;

/** 中日韩统一表意文字（含扩展 A 区） */
const HAN_RE = /\p{Script=Han}/u;

/** 拉丁字母；数字与标点不能作为英文判断依据 */
const LATIN_RE = /\p{Script=Latin}/u;

/**
 * 判断歌词行是否包含有效的翻译歌词
 * @param line - 歌词行对象
 * @returns 是否包含非空翻译
 */
const hasTranslation = (line: LyricLine): boolean => line.translatedLyric.trim().length > 0;

/**
 * 为歌词行自动推断并填充语言代码（ja / ko / zh-CN / und-Latn）
 * @param lines - 歌词行数组（原地更新各行 language 属性）
 * @returns 无返回值（原地修改）
 */
export const applyLyricLanguages = (lines: LyricLine[]): void => {
  const lineContents = lines.map((line) => line.words.map((word) => word.word).join(""));

  let hasKana = false;
  let hasHangul = false;
  let kanaUntranslatedCount = 0;
  let hangulUntranslatedCount = 0;

  for (let index = 0; index < lines.length; index++) {
    const content = lineContents[index];
    const isTranslated = hasTranslation(lines[index]);

    if (KANA_RE.test(content)) {
      hasKana = true;
      if (!isTranslated) kanaUntranslatedCount++;
    }
    if (HANGUL_RE.test(content)) {
      hasHangul = true;
      if (!isTranslated) hangulUntranslatedCount++;
    }
  }

  const allKanaTranslated = hasKana && kanaUntranslatedCount === 0;
  const allHangulTranslated = hasHangul && hangulUntranslatedCount === 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const content = lineContents[index];
    const isTranslated = hasTranslation(line);

    if (KANA_RE.test(content)) {
      line.language = "ja";
    } else if (HANGUL_RE.test(content)) {
      line.language = "ko";
    } else if (HAN_RE.test(content)) {
      if (hasKana) {
        line.language = allKanaTranslated && !isTranslated ? "zh-CN" : "ja";
      } else if (hasHangul) {
        line.language = allHangulTranslated && !isTranslated ? "zh-CN" : "ko";
      } else {
        line.language = "zh-CN";
      }
    } else if (LATIN_RE.test(content)) {
      line.language = "und-Latn";
    } else {
      delete line.language;
    }
  }
};
