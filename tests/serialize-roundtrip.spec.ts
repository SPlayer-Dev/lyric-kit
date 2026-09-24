import { describe, expect, it } from "vitest";
import { parseSRT } from "../src/parse";
import { serializeLyric, toSRT } from "../src/serialize";
import type { LyricLine } from "../src/types";

const makeLine = (
  translatedLyric = "你好",
  romanLyric = "konnichiwa",
  isBG = false,
): LyricLine => ({
  startTime: 1000,
  endTime: 2000,
  words: [{ word: "こんにちは", startTime: 1000, endTime: 2000 }],
  translatedLyric,
  romanLyric,
  isBG,
  isDuet: false,
});

describe("SRT 兼容性与往返导出", () => {
  it("默认输出保持原来的字幕展示顺序", () => {
    expect(toSRT([makeLine()])).toBe(
      "1\n00:00:01,000 --> 00:00:02,000\nkonnichiwa\n你好\nこんにちは",
    );
  });

  it.each([
    ["你好", "konnichiwa"],
    ["", "konnichiwa"],
    ["你好", ""],
    ["", ""],
  ])("显式往返模式保留翻译 %s 和罗马音 %s 的位置", (translation, roman) => {
    const input = [makeLine(translation, roman)];
    const before = structuredClone(input);
    const output = toSRT(input, { roundTrip: true });
    expect(parseSRT(output, { multiLineMode: "bilingual" }).lines).toEqual(input);
    expect(serializeLyric(input, "srt", { roundTrip: true })).toBe(output);
    expect(input).toEqual(before);
  });
});
