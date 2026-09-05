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

  it("toEnhancedLrc 应正确导出 endsWithSpace 词间空格", () => {
    const lines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 3000,
        words: [
          { startTime: 1000, endTime: 2000, word: "Hello", endsWithSpace: true },
          { startTime: 2000, endTime: 3000, word: "World" },
        ],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
    ];
    const elrc = toEnhancedLrc(lines);
    expect(elrc).toBe("[00:01.00]<00:01.00>Hello <00:02.00>World");
  });

  it("toTtml 应支持导出 tts:ruby、songPart、endsWithSpace 与 AMLL 特性", () => {
    const lines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 3000,
        songPart: "Chorus",
        words: [
          {
            startTime: 1000,
            endTime: 2000,
            word: "漢字",
            ruby: [
              { word: "かん", startTime: 1000, endTime: 1500 },
              { word: "じ", startTime: 1500, endTime: 2000 },
            ],
            endsWithSpace: true,
          },
          {
            startTime: 2000,
            endTime: 3000,
            word: "Rock",
            obscene: true,
            emptyBeat: 2,
          },
        ],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
    ];
    const ttml = toTtml(lines);
    expect(ttml).toContain('itunes:song-part="Chorus"');
    expect(ttml).toContain('tts:ruby="container"');
    expect(ttml).toContain('tts:ruby="base"');
    expect(ttml).toContain('tts:ruby="text"');
    expect(ttml).toContain("かん");
    expect(ttml).toContain("じ");
    expect(ttml).toContain('amll:obscene="true"');
    expect(ttml).toContain('amll:empty-beat="2"');
  });

  it("toTtml 应输出包含 begin/end 的背景人声标签与 metadata head", () => {
    const lines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 3000,
        words: [{ startTime: 1000, endTime: 3000, word: "主旋律" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
      {
        startTime: 1500,
        endTime: 2500,
        words: [{ startTime: 1500, endTime: 2500, word: "和声" }],
        translatedLyric: "harmony",
        romanLyric: "",
        isBG: true,
        isDuet: false,
      },
    ];

    const ttml = toTtml({
      lines,
      metadata: {
        title: ["测试曲目"],
        artist: ["演唱者"],
        album: ["测试专辑"],
        songwriters: ["词曲作者"],
        agents: {
          v1: { id: "v1", name: "演唱者", type: "person" },
        },
      },
    });

    expect(ttml).toContain('<span ttm:role="x-bg" begin="00:01.500" end="00:02.500">');
    expect(ttml).toContain("<head>");
    expect(ttml).toContain("<metadata>");
    expect(ttml).toContain('<amll:meta key="musicName" value="测试曲目" />');
    expect(ttml).toContain('<amll:meta key="artists" value="演唱者" />');
    expect(ttml).toContain('<amll:meta key="album" value="测试专辑" />');
    expect(ttml).toContain("<itunes:songwriter>词曲作者</itunes:songwriter>");
    expect(ttml).toContain('<ttm:agent type="person" xml:id="v1">');
    expect(ttml).toContain('<ttm:name type="full">演唱者</ttm:name>');
  });
});
