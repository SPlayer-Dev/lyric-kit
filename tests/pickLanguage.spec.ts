import { describe, expect, it } from "vitest";
import { pickLangIndex } from "../src/utils/pickLanguage";

describe("pickLangIndex", () => {
  it("传入 zh-CN 时应优先匹配 zh-Hans", () => {
    const langs = ["ja", "zh-Hant", "zh-Hans", "en"];
    const preferred = "zh-CN";
    expect(pickLangIndex(langs, preferred)).toBe(2);
  });

  it.each([
    { langs: ["zh-Hant"], preferred: "zh-CN", expected: -1 },
    { langs: ["zh-Hant", "zh"], preferred: "zh-CN", expected: 1 },
    { langs: ["zh-TW", "zh-SG"], preferred: "zh-CN", expected: 1 },
    { langs: ["zh-Hant-HK", "zh-Hans-SG"], preferred: "zh_Hans_CN", expected: 1 },
    { langs: ["zh-Hans", "zh-TW"], preferred: "zh-Hant", expected: 1 },
    { langs: ["zh-CN"], preferred: "zh-HK", expected: -1 },
    { langs: ["zh-Hant", "zh-Hans"], preferred: "zh", expected: 0 },
    { langs: ["zh-Hant", "zh-Hans"], preferred: "", expected: 0 },
    { langs: [null], preferred: "zh-CN", expected: 0 },
    { langs: ["ja", "en-US"], preferred: "en-GB", expected: 1 },
  ])("按字形约束匹配 $preferred -> $langs", ({ langs, preferred, expected }) => {
    expect(pickLangIndex(langs, preferred)).toBe(expected);
  });
});
