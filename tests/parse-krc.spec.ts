import { describe, expect, it } from "vitest";
import { parseKRC } from "../src/parse";

describe("parseKRC", () => {
  it("应解析酷狗 KRC 纯文本逐字", () => {
    // [00:01.000]<0,500>酷<500,500>狗<1000,500>音<1500,500>乐
    const text = `[00:01.000]<0,500>酷<500,500>狗<1000,500>音<1500,500>乐`;
    const lines = parseKRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(3000);
    expect(lines[0].words).toHaveLength(4);
    expect(lines[0].words[0]).toEqual({ word: "酷", startTime: 1000, endTime: 1500 });
    expect(lines[0].words[3]).toEqual({ word: "乐", startTime: 2500, endTime: 3000 });
  });

  it("正确解析毫秒位数", () => {
    // 注意 KRC 的规范是毫秒不 padEnd，例如 [00:01.5] 代表 1005ms
    const text = `[00:01.5]<0,300>字`;
    const lines = parseKRC(text);

    expect(lines[0].startTime).toBe(1005);
    expect(lines[0].endTime).toBe(1305);
  });

  it("应正确解析西文词间空格标记 endsWithSpace", () => {
    const text = `[00:01.000]<0,500>Hello <500,500>World`;
    const lines = parseKRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello");
    expect(lines[0].words[0].endsWithSpace).toBe(true);
    expect(lines[0].words[1].word).toBe("World");
    expect(lines[0].words[1].endsWithSpace).toBeUndefined();
  });
});
