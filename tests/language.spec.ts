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

  it("整行纯汉字但包含假名 ruby 注音时应识别为日语", () => {
    const line: LyricLine = {
      startTime: 0,
      endTime: 1000,
      words: [
        {
          word: "曖昧模糊",
          startTime: 0,
          endTime: 1000,
          ruby: [{ word: "あいまいもこ", startTime: 0, endTime: 1000 }],
        },
      ],
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    };
    applyLyricLanguages([line]);
    expect(line.language).toBe("ja");
  });

  it("华语流行歌偶尔插入单句日文时，纯汉字行不应被误判为日语", () => {
    const lines = [
      makeLine("这是一首中文歌"),
      makeLine("每一句都是汉字"),
      makeLine("旋律非常动听"),
      makeLine("大家一起唱"),
      makeLine("再来一段副歌"),
      makeLine("ありがとう"),
    ];
    applyLyricLanguages(lines);
    expect(lines.slice(0, 5).map((l) => l.language)).toEqual([
      "zh-CN",
      "zh-CN",
      "zh-CN",
      "zh-CN",
      "zh-CN",
    ]);
    expect(lines[5].language).toBe("ja");
  });

  it("华语流行歌偶尔插入单句韩文时，纯汉字行不应被误判为韩语", () => {
    const lines = [
      makeLine("第一行中文"),
      makeLine("第二行中文"),
      makeLine("第三行中文"),
      makeLine("第四行中文"),
      makeLine("안녕하세요"),
    ];
    applyLyricLanguages(lines);
    expect(lines.slice(0, 4).map((l) => l.language)).toEqual(["zh-CN", "zh-CN", "zh-CN", "zh-CN"]);
    expect(lines[4].language).toBe("ko");
  });

  it("以日文为主的歌曲（假名行比例高于阈值），纯汉字行应正确推断为日语", () => {
    const lines = [
      makeLine("君が好きだよ"),
      makeLine("桜が咲く"),
      makeLine("恋愛写真"),
      makeLine("花鸟风月"),
    ];
    applyLyricLanguages(lines);
    expect(lines.map((l) => l.language)).toEqual(["ja", "ja", "ja", "ja"]);
  });
});
