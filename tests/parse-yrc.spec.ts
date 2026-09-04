import { describe, expect, it } from "vitest";
import { parseYRC } from "../src/parse";

describe("parseYRC", () => {
  it("应解析网易云 YRC 逐字歌词", () => {
    const text = `[500,2000](500,500,0)网(1000,500,0)易(1500,500,0)云(2000,500,0)歌(2500,0,0)`;
    const lines = parseYRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(500);
    expect(lines[0].endTime).toBe(2500);
    expect(lines[0].words).toHaveLength(4);
    expect(lines[0].words[0]).toEqual({ word: "网", startTime: 500, endTime: 1000 });
    expect(lines[0].words[2]).toEqual({ word: "云", startTime: 1500, endTime: 2000 });
    expect(lines[0].words[3]).toEqual({ word: "歌", startTime: 2000, endTime: 2500 });
  });

  it("应处理多行 YRC", () => {
    const text = `[100,1000](100,500,0)A(600,500,0)B\n[1200,1000](1200,500,0)C(1700,500,0)D`;
    const lines = parseYRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].startTime).toBe(100);
    expect(lines[1].startTime).toBe(1200);
  });

  it("应正确提取西文词间空格标记 endsWithSpace", () => {
    const text = `[0,2000](0,500,0)Hello (500,500,0)World`;
    const lines = parseYRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello");
    expect(lines[0].words[0].endsWithSpace).toBe(true);
    expect(lines[0].words[1].word).toBe("World");
    expect(lines[0].words[1].endsWithSpace).toBeUndefined();
  });
});
