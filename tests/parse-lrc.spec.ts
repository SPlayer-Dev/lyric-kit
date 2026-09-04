import { describe, expect, it } from "vitest";
import { parseLRC, parseLyric } from "../src/parse";

describe("parseLRC", () => {
  it("应正确解析标准逐行 LRC 并按时间排序", () => {
    const text = `[ar:周杰伦]\n[00:03.00]第三句\n[00:01.00]第一句\n[00:02.00]第二句`;
    const lines = parseLRC(text);

    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.startTime)).toEqual([1000, 2000, 3000]);
    expect(lines[0].words[0].word).toBe("第一句");
    expect(lines[0].endTime).toBe(2000);
    expect(lines[1].endTime).toBe(3000);
  });

  it("应支持多时间戳展开", () => {
    const text = `[00:01.00][00:05.00]副歌重复行`;
    const lines = parseLRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[1].startTime).toBe(5000);
    expect(lines[0].words[0].word).toBe("副歌重复行");
  });

  it("应解析 ESLRC 尖括号逐字时间", () => {
    const text = `[00:01.00]<00:01.00>你<00:01.30>好<00:01.80>世<00:02.20>界<00:02.60>`;
    const lines = parseLRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(4);
    expect(lines[0].words[0]).toEqual({
      word: "你",
      startTime: 1000,
      endTime: 1300,
    });
    expect(lines[0].words[3]).toEqual({
      word: "界",
      startTime: 2200,
      endTime: 2600,
    });
    expect(lines[0].endTime).toBe(2600);
  });

  it("应通过 parseLyric 成功对齐翻译与音译", () => {
    const lines = parseLyric({
      content: "[00:01.00]Hello\n[00:03.00]Goodbye",
      translation: "[00:01.05]你好\n[00:03.00]再见",
      romaji: "[00:01.00]haro\n[00:03.05]gubbai",
    });

    expect(lines).toHaveLength(2);
    expect(lines[0].translatedLyric).toBe("你好");
    expect(lines[0].romanLyric).toBe("haro");
    expect(lines[1].translatedLyric).toBe("再见");
    expect(lines[1].romanLyric).toBe("gubbai");
  });

  it("应拆分行内尾随和声为独立背景音行", () => {
    const text = `[00:01.00]<00:01.00>主歌词<00:01.50>(<00:01.50>和声部分<00:02.00>)`;
    const lines = parseLRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].isBG).toBe(false);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("主歌词");
    expect(lines[1].isBG).toBe(true);
    expect(lines[1].words.map((w) => w.word).join("")).toBe("和声部分");
  });

  it("应解析带空格的 ESLRC 逐字歌词并标记 endsWithSpace", () => {
    const text = `[00:01.00]<00:01.00>Hello <00:01.50>World<00:02.00>`;
    const lines = parseLRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello");
    expect(lines[0].words[0].endsWithSpace).toBe(true);
    expect(lines[0].words[1].word).toBe("World");
    expect(lines[0].words[1].endsWithSpace).toBeUndefined();
  });
});
