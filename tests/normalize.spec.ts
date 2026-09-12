import { describe, expect, it } from "vitest";
import { normalizeLyricLines } from "../src/clean/normalize";
import type { LyricLine } from "../src/types";

describe("normalizeLyricLines", () => {
  it("应自动规整多余连续空格", () => {
    const lines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 2000,
        words: [{ startTime: 1000, endTime: 2000, word: "Hello    World" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
    ];

    normalizeLyricLines(lines);
    expect(lines[0].words[0].word).toBe("Hello World");
  });

  it("应同步主行与紧随背景行的时间窗", () => {
    const lines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 2000,
        words: [{ startTime: 1000, endTime: 2000, word: "Main" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
      {
        startTime: 1500,
        endTime: 2500,
        words: [{ startTime: 1500, endTime: 2500, word: "BG" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: true,
        isDuet: false,
      },
    ];

    normalizeLyricLines(lines);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(2500);
    expect(lines[1].startTime).toBe(1000);
    expect(lines[1].endTime).toBe(2500);
  });

  it("应修正小幅非刻意重叠", () => {
    const lines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 2050, // 与下一行重叠 50ms（<= 100ms 且 <= 10%）
        words: [{ startTime: 1000, endTime: 2050, word: "Line 1" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
      {
        startTime: 2000,
        endTime: 3000,
        words: [{ startTime: 2000, endTime: 3000, word: "Line 2" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
    ];

    normalizeLyricLines(lines);
    expect(lines[0].endTime).toBe(2000);
  });

  it("首行背景行与连续背景行无依附主行时应自动降级为主行", () => {
    const lines: LyricLine[] = [
      {
        startTime: 500,
        endTime: 1000,
        words: [{ startTime: 500, endTime: 1000, word: "BG 1" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: true,
        isDuet: false,
      },
      {
        startTime: 1000,
        endTime: 2000,
        words: [{ startTime: 1000, endTime: 2000, word: "Main" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
      {
        startTime: 1200,
        endTime: 1800,
        words: [{ startTime: 1200, endTime: 1800, word: "BG 2" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: true,
        isDuet: false,
      },
      {
        startTime: 1300,
        endTime: 1900,
        words: [{ startTime: 1300, endTime: 1900, word: "BG 3" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: true,
        isDuet: false,
      },
    ];

    normalizeLyricLines(lines);
    expect(lines[0].isBG).toBe(false);
    expect(lines[2].isBG).toBe(true);
    expect(lines[3].isBG).toBe(false);
  });
});
