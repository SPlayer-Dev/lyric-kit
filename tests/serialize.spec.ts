import { describe, expect, it } from "vitest";
import { serializeLyric, toEnhancedLrc, toLrc, toSrt, toTtml } from "../src/serialize";
import type { LyricLine } from "../src/types";

const mockLines: LyricLine[] = [
  {
    startTime: 1000,
    endTime: 3000,
    words: [
      { startTime: 1000, endTime: 2000, word: "你" },
      { startTime: 2000, endTime: 3000, word: "好" },
    ],
    translatedLyric: "Hello",
    romanLyric: "Nihao",
    isBG: false,
    isDuet: false,
  },
];

describe("serialize", () => {
  it("toLrc 应输出标准 LRC 格式与双语行", () => {
    const lrc = toLrc(mockLines);
    expect(lrc).toBe("[00:01.00]你好\n[00:01.00]Hello");
  });

  it("toEnhancedLrc 应输出带有内联时间戳的逐字 LRC", () => {
    const elrc = toEnhancedLrc(mockLines);
    expect(elrc).toBe("[00:01.00]<00:01.00>你<00:02.00>好\n[00:01.00]Hello");
  });

  it("toTtml 应输出标准 XML 并包含 begin/end", () => {
    const ttml = toTtml(mockLines);
    expect(ttml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(ttml).toContain('<span begin="00:01.000" end="00:02.000">你</span>');
    expect(ttml).toContain('<span begin="00:02.000" end="00:03.000">好</span>');
    expect(ttml).toContain('<span ttm:role="x-translation">Hello</span>');
  });

  it("toSrt 应输出编号与时间轴块", () => {
    const srt = toSrt(mockLines);
    expect(srt).toBe("1\n00:00:01,000 --> 00:00:03,000\nNihao\nHello\n你好");
  });

  it("serializeLyric 统一入口支持直接接收 LyricLine[] 与自动导出", () => {
    expect(serializeLyric(mockLines, "lrc")).toBe(toLrc(mockLines));
    expect(serializeLyric(mockLines, "elrc")).toBe(toEnhancedLrc(mockLines));
    expect(serializeLyric(mockLines, "ttml")).toBe(toTtml(mockLines));
    expect(serializeLyric(mockLines, "srt")).toBe(toSrt(mockLines));
  });
});
