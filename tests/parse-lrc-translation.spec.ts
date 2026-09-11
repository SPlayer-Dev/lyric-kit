import { describe, expect, it } from "vitest";
import { parseLRC } from "../src/parse/lrc";

describe("parseLRC 同时间戳翻译合并（单文档路径）", () => {
  it("正文与同时间戳翻译/音译行应合并到同一行的 translatedLyric/romanLyric", () => {
    const text = `[00:01.00]你好\n[00:01.00]Hello\n[00:01.00]ni hao\n[00:02.00]再见`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("你好");
    expect(lines[0].translatedLyric).toBe("Hello");
    expect(lines[0].romanLyric).toBe("ni hao");
    expect(lines[1].words[0].word).toBe("再见");
  });

  it("主行时间戳早于后续翻译行时，倒序剪枝不应误合并到更早的行", () => {
    const text = `[00:01.00]你好\n[00:01.00]Hello\n[00:05.00]再见\n[00:05.00]Goodbye`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].translatedLyric).toBe("Hello");
    expect(lines[1].translatedLyric).toBe("Goodbye");
  });
});
