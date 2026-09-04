import { describe, expect, it } from "vitest";
import { parseASS, parseSRT } from "../src/parse";

describe("parseSRT & parseASS", () => {
  it("应解析标准 SRT 字幕", () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
音译
翻译
原词文本

2
00:00:04,500 --> 00:00:06,000
只有一行原词`;

    const lines = parseSRT(srt);

    expect(lines).toHaveLength(2);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(3000);
    expect(lines[0].words[0].word).toBe("原词文本");
    expect(lines[0].translatedLyric).toBe("翻译");
    expect(lines[0].romanLyric).toBe("音译");

    expect(lines[1].startTime).toBe(4500);
    expect(lines[1].endTime).toBe(6000);
    expect(lines[1].words[0].word).toBe("只有一行原词");
    expect(lines[1].translatedLyric).toBe("");
  });

  it("应解析 ASS 卡拉OK 逐字标签与多 Style 自动合并", () => {
    const ass = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,orig,,0,0,0,,{\\kf100}你{\\kf100}好
Dialogue: 0,0:00:01.00,0:00:03.00,ts,,0,0,0,,Hello
Dialogue: 0,0:00:01.00,0:00:03.00,roma,,0,0,0,,Ni Hao`;

    const lines = parseASS(ass);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(3000);
    expect(lines[0].translatedLyric).toBe("Hello");
    expect(lines[0].romanLyric).toBe("Ni Hao");
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0]).toEqual({ word: "你", startTime: 1000, endTime: 2000 });
    expect(lines[0].words[1]).toEqual({ word: "好", startTime: 2000, endTime: 3000 });
  });
});
