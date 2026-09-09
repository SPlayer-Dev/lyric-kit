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

  it("默认合并内置规则与用户自定义关键词", () => {
    const lines = [makeLine("编曲：钟兴民"), makeLine("海风轻拂着发梢")];

    const stripped = stripLyricMetadata(lines, {
      keywords: ["混音师"],
    });

    expect(stripped).toHaveLength(1);
    expect(stripped[0].words[0].word).toBe("海风轻拂着发梢");
  });

  it("useDefaultRules 为 false 时仅使用用户传入的关键词", () => {
    const lines = [makeLine("混音师"), makeLine("编曲"), makeLine("海风轻拂着发梢")];

    const stripped = stripLyricMetadata(lines, {
      useDefaultRules: false,
      keywords: ["混音师"],
    });

    expect(stripped).toHaveLength(2);
    expect(stripped[0].words[0].word).toBe("编曲");
    expect(stripped[1].words[0].word).toBe("海风轻拂着发梢");
  });

  it("无任何选项时默认启用内置规则", () => {
    const lines = [makeLine("词：方文山"), makeLine("海风轻拂着发梢")];

    const stripped = stripLyricMetadata(lines, {});
    expect(stripped).toHaveLength(1);
  });

  it("应剥离中英双语标签的元数据行", () => {
    const lines = [
      makeLine("作曲 Composer: 李洋 Yang Lee"),
      makeLine("母带制作 Mastering Engineer：宫奇Gon"),
      makeLine("出品 Produced by：HOYO-MiX"),
      makeLine("海风轻拂着发梢"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
    expect(stripped[0].words[0].word).toBe("海风轻拂着发梢");
  });

  it("应剥离混音/母带等组合标签", () => {
    const lines = [
      makeLine("混音/母带 Mixing/Mastering Engineer：黄巍"),
      makeLine("第一句真正的歌词"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
  });

  it("应保留声部标识行（裸标签与带内容均视为歌曲结构）", () => {
    const lines = [
      makeLine("合："),
      makeLine("男："),
      makeLine("女：在屋顶唱着你的歌"),
      makeLine("海风轻拂着发梢"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(4);
  });

  it("应剥离制作类与商务联系元数据行", () => {
    const lines = [
      makeLine("出品方：某某音乐"),
      makeLine("特别感谢：所有歌迷"),
      makeLine("业务联系：yunmusic_2013@163.com"),
      makeLine("海风轻拂着发梢"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
  });

  it("应归一化兼容字形后再匹配关键词", () => {
    const lines = [makeLine("混⾳：TC"), makeLine("海风轻拂着发梢")];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
  });

  it("应剥离借鉴词库的制作与乐器元数据行", () => {
    const lines = [
      makeLine("配器：陈致逸"),
      makeLine("指挥：李心草"),
      makeLine("唱片公司：太合麦田"),
      makeLine("马头琴：塔林图雅"),
      makeLine("未经授权，禁止转载"),
      makeLine("海风轻拂着发梢"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
  });
});
