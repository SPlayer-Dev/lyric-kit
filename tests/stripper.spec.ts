import { describe, expect, it } from "vitest";
import { stripLyricMetadata } from "../src/clean/stripper";
import type { LyricLine } from "../src/types";

const makeLine = (text: string, start = 0): LyricLine => ({
  words: [{ startTime: start, endTime: start + 1000, word: text }],
  translatedLyric: "",
  romanLyric: "",
  startTime: start,
  endTime: start + 1000,
  isBG: false,
  isDuet: false,
});

describe("stripLyricMetadata", () => {
  it("应剥离头部的制作人/词曲作者行", () => {
    const lines = [
      makeLine("词：方文山"),
      makeLine("曲：周杰伦"),
      makeLine("编曲：钟兴民"),
      makeLine("海风轻拂着发梢"),
      makeLine("带来夏天的味道"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(2);
    expect(stripped[0].words[0].word).toBe("海风轻拂着发梢");
  });

  it("应剥离尾部的版权与出品声明", () => {
    const lines = [
      makeLine("第一句真正的歌词"),
      makeLine("第二句真正的歌词"),
      makeLine("出品：杰威尔音乐"),
      makeLine("未经著作权人许可不得翻唱"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(2);
    expect(stripped[1].words[0].word).toBe("第二句真正的歌词");
  });

  it("应支持首行「歌曲名 - 歌手名」匹配剔除", () => {
    const lines = [
      makeLine("晴天 - 周杰伦"),
      makeLine("故事的小黄花"),
      makeLine("从出生那年就飘着"),
    ];

    const stripped = stripLyricMetadata(lines, {
      matchMetadata: {
        title: "晴天",
        artists: ["周杰伦"],
      },
    });

    expect(stripped).toHaveLength(2);
    expect(stripped[0].words[0].word).toBe("故事的小黄花");
  });
});
