import { describe, expect, it } from "vitest";
import { applyLyricLanguages } from "../src/clean/language";
import type { LyricLine } from "../src/types";

const makeLine = (content: string, options: Partial<LyricLine> = {}): LyricLine => ({
  words: [{ word: content, startTime: 0, endTime: 1000 }],
  translatedLyric: "",
  romanLyric: "",
  startTime: 0,
  endTime: 1000,
  isBG: false,
  isDuet: false,
  ...options,
});

describe("applyLyricLanguages", () => {
  it("用假名上下文将纯汉字行识别为日语", () => {
    const lines = [makeLine("愛"), makeLine("君が好き")];
    applyLyricLanguages(lines);
    expect(lines.map((l) => l.language)).toEqual(["ja", "ja"]);
  });

  it("通过翻译推断双语混合歌曲的纯汉字行", () => {
    const lines = [makeLine("爱"), makeLine("君が好き", { translatedLyric: "我喜欢你" })];
    applyLyricLanguages(lines);
    expect(lines.map((l) => l.language)).toEqual(["zh-CN", "ja"]);
  });

  it("将没有其他 CJK 上下文的汉字行识别为中文", () => {
    const lines = [makeLine("爱"), makeLine("未来")];
    applyLyricLanguages(lines);
    expect(lines.map((l) => l.language)).toEqual(["zh-CN", "zh-CN"]);
  });

  it("不把拉丁文字断言为英语，使用 und-Latn", () => {
    const lines = [makeLine("Hello world"), makeLine("Hola mundo")];
    applyLyricLanguages(lines);
    expect(lines.map((l) => l.language)).toEqual(["und-Latn", "und-Latn"]);
  });
});
