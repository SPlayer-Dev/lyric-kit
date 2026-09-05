import { describe, expect, it } from "vitest";
import { parseLRC } from "../src/parse/lrc";
import type { LyricLine, LyricWord } from "../src/types";
import {
  detectBackgroundLine,
  isFullyEnclosedByParens,
  splitTrailingBackground,
} from "../src/utils/bg";

describe("背景音启发式识别与拆分 (bg utils)", () => {
  describe("括号完整包裹判断 isFullyEnclosedByParens", () => {
    it("单对括号完整包裹应返回 true", () => {
      expect(isFullyEnclosedByParens("(Yeah)")).toBe(true);
      expect(isFullyEnclosedByParens("（和声内容）")).toBe(true);
      expect(isFullyEnclosedByParens("  (With spaces)  ")).toBe(true);
    });

    it("允许括号闭合后紧跟尾随语气标点", () => {
      expect(isFullyEnclosedByParens("(Fine, fine, fine)!")).toBe(true);
      expect(isFullyEnclosedByParens("（太棒了）~")).toBe(true);
      expect(isFullyEnclosedByParens("(Ooh)...")).toBe(true);
      expect(isFullyEnclosedByParens("（呜）？！")).toBe(true);
    });

    it("首尾假象（中途闭合、包含主句）应返回 false", () => {
      expect(isFullyEnclosedByParens("（Yeah） And we'll never be royals （royals）")).toBe(false);
      expect(isFullyEnclosedByParens("(One) and (Two)")).toBe(false);
      expect(isFullyEnclosedByParens("(男) 天青色等烟雨 (和声)")).toBe(false);
    });

    it("非括号开头或结尾应返回 false", () => {
      expect(isFullyEnclosedByParens("Hello (world)")).toBe(false);
      expect(isFullyEnclosedByParens("(Hello) world")).toBe(false);
      expect(isFullyEnclosedByParens("Hello world")).toBe(false);
    });
  });

  describe("整行背景识别与空节点过滤 detectBackgroundLine", () => {
    it("应正确识别整行背景并剥除括号", () => {
      const words: LyricWord[] = [
        { startTime: 1000, endTime: 1500, word: "（" },
        { startTime: 1500, endTime: 2500, word: "和声" },
        { startTime: 2500, endTime: 3000, word: "）" },
      ];
      const isBG = detectBackgroundLine(words, true);

      expect(isBG).toBe(true);
      expect(words).toHaveLength(1);
      expect(words[0].word).toBe("和声");
      expect(words[0].startTime).toBe(1000);
      expect(words[0].endTime).toBe(3000);
      expect(words.some((w) => w.word === "")).toBe(false);
    });

    it("首尾假象行不应误判为背景行且保持原词不被篡改", () => {
      const words: LyricWord[] = [
        { startTime: 1000, endTime: 1500, word: "（Yeah）" },
        { startTime: 1500, endTime: 2000, word: "And" },
        { startTime: 2000, endTime: 2500, word: "royals" },
        { startTime: 2500, endTime: 3000, word: "（royals）" },
      ];
      const isBG = detectBackgroundLine(words, true);

      expect(isBG).toBe(false);
      expect(words[0].word).toBe("（Yeah）");
      expect(words[3].word).toBe("（royals）");
    });

    it("未启用 detectBackground 时应直接返回 false", () => {
      const words: LyricWord[] = [{ startTime: 0, endTime: 1000, word: "(和声)" }];
      expect(detectBackgroundLine(words, false)).toBe(false);
      expect(words[0].word).toBe("(和声)");
    });
  });

  describe("尾随和声拆分 splitTrailingBackground", () => {
    it("支持单 word 普通逐行 LRC 拆分尾随和声", () => {
      const line: LyricLine = {
        words: [
          {
            startTime: 1000,
            endTime: 4000,
            word: "Cause when it all falls down （Then whatever, babe）",
          },
        ],
        translatedLyric: "",
        romanLyric: "",
        startTime: 1000,
        endTime: 4000,
        isBG: false,
        isDuet: false,
      };

      const bgLine = splitTrailingBackground(line, true);

      expect(bgLine).not.toBeNull();
      expect(line.words[0].word).toBe("Cause when it all falls down");
      expect(bgLine?.isBG).toBe(true);
      expect(bgLine?.words[0].word).toBe("Then whatever, babe");
      expect(bgLine?.startTime).toBe(1000);
      expect(bgLine?.endTime).toBe(4000);
      expect(bgLine?.words.some((w) => w.word === "")).toBe(false);
    });

    it("支持行首为 (男) 声部词且行尾包含真正和声的拆分", () => {
      const line: LyricLine = {
        words: [
          {
            startTime: 2000,
            endTime: 5000,
            word: "(男) 天青色等烟雨 (而我在等你)",
          },
        ],
        translatedLyric: "",
        romanLyric: "",
        startTime: 2000,
        endTime: 5000,
        isBG: false,
        isDuet: false,
      };

      const bgLine = splitTrailingBackground(line, true);

      expect(bgLine).not.toBeNull();
      expect(line.words[0].word).toBe("(男) 天青色等烟雨");
      expect(line.isBG).toBe(false);
      expect(bgLine?.isBG).toBe(true);
      expect(bgLine?.words[0].word).toBe("而我在等你");
    });

    it("尾部括号为日文假名注音时不应作为和声拆分", () => {
      const line: LyricLine = {
        words: [
          {
            startTime: 1000,
            endTime: 3000,
            word: "明日 (あした)",
          },
        ],
        translatedLyric: "",
        romanLyric: "",
        startTime: 1000,
        endTime: 3000,
        isBG: false,
        isDuet: false,
      };

      const bgLine = splitTrailingBackground(line, true);
      expect(bgLine).toBeNull();
    });

    it("逐字歌词拆分尾随和声应彻底过滤空节点并对齐时间", () => {
      const line: LyricLine = {
        words: [
          { startTime: 1000, endTime: 1500, word: "Hello" },
          { startTime: 1500, endTime: 2000, word: "world" },
          { startTime: 2000, endTime: 2200, word: "（" },
          { startTime: 2200, endTime: 2800, word: "echo" },
          { startTime: 2800, endTime: 3000, word: "）" },
        ],
        translatedLyric: "",
        romanLyric: "",
        startTime: 1000,
        endTime: 3000,
        isBG: false,
        isDuet: false,
      };

      const bgLine = splitTrailingBackground(line, true);

      expect(bgLine).not.toBeNull();
      expect(line.words).toHaveLength(2);
      expect(line.endTime).toBe(2000);

      expect(bgLine?.words).toHaveLength(1);
      expect(bgLine?.words[0].word).toBe("echo");
      expect(bgLine?.startTime).toBe(2000);
      expect(bgLine?.endTime).toBe(3000);
      expect(bgLine?.words.some((w) => w.word === "")).toBe(false);
    });
  });

  describe("parseLRC 全流程集成测试", () => {
    it("普通逐行歌词开启 detectBackground 能正确保留主歌词与背景歌词且不污染翻译", () => {
      const lrc = `[00:01.00]Cause when it all falls down （Then whatever, babe）\n[00:01.00]因为当一切崩塌（那就随它去吧 宝贝）\n[00:05.00]下一句歌词`;
      const { lines } = parseLRC(lrc, { detectBackground: true });

      expect(lines).toHaveLength(3);
      expect(lines[0].isBG).toBe(false);
      expect(lines[0].words[0].word).toBe("Cause when it all falls down");
      expect(lines[0].translatedLyric).toBe("因为当一切崩塌");
      expect(lines[0].endTime).toBe(5000);

      expect(lines[1].isBG).toBe(true);
      expect(lines[1].words[0].word).toBe("Then whatever, babe");
      expect(lines[1].translatedLyric).toBe("那就随它去吧 宝贝");
      expect(lines[1].endTime).toBe(5000);

      expect(lines[2].words[0].word).toBe("下一句歌词");
    });

    it("行首包含括号时主歌词不作为背景行", () => {
      const lrc = `[00:01.00](男) 你好\n[00:03.00]（女）世界`;
      const { lines } = parseLRC(lrc, { detectBackground: true });

      expect(lines).toHaveLength(2);
      expect(lines[0].isBG).toBe(false);
      expect(lines[1].isBG).toBe(false);
    });
  });
});
