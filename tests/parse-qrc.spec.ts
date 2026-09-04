import { describe, expect, it } from "vitest";
import { parseQRC } from "../src/parse";

describe("parseQRC", () => {
  it("应解析纯文本格式 QRC 逐字歌词", () => {
    const text = `[1000,2000]这(1000,500)是(1500,500)测(2000,500)试(2500,500)`;
    const lines = parseQRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(3000);
    expect(lines[0].words).toHaveLength(4);
    expect(lines[0].words[0]).toEqual({ word: "这", startTime: 1000, endTime: 1500 });
    expect(lines[0].words[3]).toEqual({ word: "试", startTime: 2500, endTime: 3000 });
  });

  it("应正确解析 XML 包裹的 QRC 歌词", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos>
  <Lyric_1 LyricContent="[2000,1000]晴(2000,500)天(2500,500)"/>
</QrcInfos>`;
    const lines = parseQRC(xml);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(2000);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("晴天");
  });

  it("应识别背景音行", () => {
    const text = `[1000,2000]（和(1000,1000)声）(2000,1000)`;
    const lines = parseQRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].isBG).toBe(true);
  });
});
