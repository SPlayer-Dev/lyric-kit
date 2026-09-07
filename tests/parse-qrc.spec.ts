import { describe, expect, it } from "vitest";
import { parseQRC } from "../src/parse";

describe("parseQRC", () => {
  it("应解析纯文本格式 QRC 逐字歌词", () => {
    const text = `[1000,2000]这(1000,500)是(1500,500)测(2000,500)试(2500,500)`;
    const { lines, metadata } = parseQRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(3000);
    expect(lines[0].words).toHaveLength(4);
    expect(lines[0].words[0]).toEqual({ word: "这", startTime: 1000, endTime: 1500 });
    expect(lines[0].words[3]).toEqual({ word: "试", startTime: 2500, endTime: 3000 });
    expect(metadata).toEqual({});
  });

  it("应正确解析 XML 包裹的 QRC 歌词并提取元数据", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos Title="晴天" Singer="周杰伦" Album="叶惠美">
  <Lyric_1 LyricContent="[ti:晴天]\n[2000,1000]晴(2000,500)天(2500,500)"/>
</QrcInfos>`;
    const { lines, metadata } = parseQRC(xml, { extractMetadata: true });

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(2000);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("晴天");
    expect(metadata.title).toEqual(["晴天"]);
    expect(metadata.artist).toEqual(["周杰伦"]);
    expect(metadata.album).toEqual(["叶惠美"]);
  });

  it("默认应识别背景音行并剥离括号", () => {
    const text = `[1000,2000]（和(1000,1000)声）(2000,1000)`;
    const { lines } = parseQRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].isBG).toBe(true);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("和声");
  });

  it("显式 detectBackground: false 时不作为背景音处理", () => {
    const text = `[1000,2000]（和(1000,1000)声）(2000,1000)`;
    const { lines } = parseQRC(text, { detectBackground: false });

    expect(lines).toHaveLength(1);
    expect(lines[0].isBG).toBe(false);
  });

  it("应正确解析西文词间空格标记 endsWithSpace", () => {
    const text = `[1000,2000]Hello (1000,1000)World(2000,1000)`;
    const { lines } = parseQRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello");
    expect(lines[0].words[0].endsWithSpace).toBe(true);
    expect(lines[0].words[1].word).toBe("World");
    expect(lines[0].words[1].endsWithSpace).toBeUndefined();
  });

  it("应支持 XML 实体反转义（&#10; 换行与 &quot; 等）", () => {
    const xml = `<QrcInfos Title="&quot;晴天&quot;" Singer="周杰伦 &amp; 朋友"><Lyric_1 LyricContent="[1000,1000]晴(1000,500)天(1500,500)&#10;[2000,1000]阴(2000,500)天(2500,500)"/></QrcInfos>`;
    const { lines, metadata } = parseQRC(xml, { extractMetadata: true });

    expect(lines).toHaveLength(2);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("晴天");
    expect(lines[1].words.map((w) => w.word).join("")).toBe("阴天");
    expect(metadata.title).toEqual(['"晴天"']);
    expect(metadata.artist).toEqual(["周杰伦 & 朋友"]);
    expect(metadata.timingMode).toBe("Word");
  });

  it("应正确使用 String.fromCodePoint 解码 >0xFFFF 的 Unicode 字符实体（Emoji）", () => {
    const xml = `<QrcInfos Title="&#128512;&#x1F3A4;"><Lyric_1 LyricContent="[1000,1000]歌(1000,500)词(1500,500)"/></QrcInfos>`;
    const { metadata } = parseQRC(xml, { extractMetadata: true });

    expect(metadata.title).toEqual(["😀🎤"]);
  });

  it("当 XML 包含多个 Lyric 节点时，非贪婪提取应保证只取主歌词而不吞掉后续内容", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos LyricCount="2">
  <Lyric_1 LyricContent="[1000,1000]原(1000,500)文(1500,500)"/>
  <Lyric_2 LyricContent="[1000,1000]翻(1000,500)译(1500,500)"/>
</QrcInfos>`;
    const { lines } = parseQRC(xml);

    expect(lines).toHaveLength(1);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("原文");
  });
});
