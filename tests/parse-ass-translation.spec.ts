import { describe, expect, it } from "vitest";
import { parseASS } from "../src/parse/ass";

describe("parseASS 翻译/音译轴配对", () => {
  it("ts/roma 声部应按相同时间戳配对到主歌词的翻译与音译字段", () => {
    const text = `[Script Info]
Title: Test
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,orig,,0,0,0,,{\\kf100}你{\\kf100}好
Dialogue: 0,0:00:01.00,0:00:03.00,ts,,0,0,0,,Hello
Dialogue: 0,0:00:01.00,0:00:03.00,roma,,0,0,0,,ni hao`;
    const { lines } = parseASS(text);
    expect(lines).toHaveLength(1);
    expect(lines[0].translatedLyric).toBe("Hello");
    expect(lines[0].romanLyric).toBe("ni hao");
    expect(lines[0].words[0].word).toBe("你");
  });

  it("带 -trans/-roman 后缀的 speaker 轨道应与主轨（同 trackBase）正确配对", () => {
    const text = `[Script Info]
Title: Test
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,v1,0,0,0,,{\\kf100}你{\\kf100}好
Dialogue: 0,0:00:01.00,0:00:03.00,Default,v1-trans,0,0,0,,Hello
Dialogue: 0,0:00:01.00,0:00:03.00,Default,v1-roman,0,0,0,,ni hao`;
    const { lines } = parseASS(text);
    expect(lines).toHaveLength(1);
    expect(lines[0].translatedLyric).toBe("Hello");
    expect(lines[0].romanLyric).toBe("ni hao");
  });

  it("时间戳不精确相等的翻译轴无法配对（当前精确匹配行为基线）", () => {
    const text = `[Script Info]
Title: Test
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,orig,main,0,0,0,,你好
Dialogue: 0,0:00:01.02,0:00:03.00,ts,main,0,0,0,,Hello`;
    const { lines } = parseASS(text);
    // 精确匹配下 20ms 时间差导致 ts 无法配对：ts 行自身无 orig 被丢弃，主行翻译为空
    expect(lines).toHaveLength(1);
    expect(lines[0].translatedLyric).toBe("");
  });
});
