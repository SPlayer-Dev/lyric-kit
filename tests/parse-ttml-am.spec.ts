import { describe, expect, it } from "vitest";
import { parseLyric, parseTTML } from "../src/parse";

const wrap = (head: string, body: string): string => `<tt xmlns="http://www.w3.org/ns/ttml"
  xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
  xmlns:itunes="http://music.apple.com/lyric-ttml-internal">
  <head><metadata><iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
    ${head}
  </iTunesMetadata></metadata></head>
  <body><div>${body}</div></body>
</tt>`;

describe.each([
  ["parseTTML", parseTTML],
  ["parseLyric", parseLyric],
] as const)("%s 的 AM TTML 兼容", (_name, parse) => {
  it.each(["", "zh-CN", "zh-Hans", "zh-Hant"])(
    "不将 replacement 作为主行或背景字幕输出（preferredLang=%s）",
    (preferredLang) => {
      const xml = wrap(
        `<translations>
          <translation type="replacement" xml:lang="zh-Hant">
            <text for="L1">這次季候風<span ttm:role="x-bg">(風)</span></text>
          </translation>
          <translation type="subtitle" xml:lang="zh-Hans">
            <text for="L2">空气中暗涌着某种悸动</text>
          </translation>
          <translation type="subtitle" xml:lang="zh-Hant">
            <text for="L2">空氣中暗湧著某種悸動</text>
          </translation>
        </translations>
        <transliterations><transliteration xml:lang="zh-Latn-jyutping">
          <text for="L1">ze5 ci3 gwai3 hau6 fung1<span ttm:role="x-bg">(fung1)</span></text>
        </transliteration></transliterations>`,
        `<p begin="1s" end="2s" itunes:key="L1">这次季候风
          <span ttm:role="x-bg">(风)</span>
        </p>
        <p begin="3s" end="4s" itunes:key="L2">There was something in the air</p>`,
      );
      const { lines } = parse(xml, { preferredLang });

      expect(lines[0].words.map((word) => word.word).join("")).toBe("这次季候风");
      expect(lines[0].translatedLyric).toBe("");
      expect(lines[0].romanLyric).toBe("ze5 ci3 gwai3 hau6 fung1");
      expect(lines[1]).toMatchObject({ isBG: true, translatedLyric: "", romanLyric: "fung1" });
      expect(lines[2].translatedLyric).toBe(
        preferredLang === "zh-Hant" ? "空氣中暗湧著某種悸動" : "空气中暗涌着某种悸动",
      );
    },
  );

  it("分别比较主行与每条 x-bg，清除重复的行级及逐字音译，保留混合行的完整音译", () => {
    const xml = wrap(
      `<translations>
        <translation type="subtitle" xml:lang="zh-Hant"><text for="L2">繁體主句
          <span ttm:role="x-bg">(繁體一)</span><span ttm:role="x-bg">(繁體二)</span>
        </text></translation>
        <translation type="subtitle" xml:lang="zh-Hans"><text for="L2">主句简译
          <span ttm:role="x-bg">(碰不到)</span><span ttm:role="x-bg">(一起)</span>
        </text></translation>
      </translations>
      <transliterations><transliteration xml:lang="ko-Latn">
        <text for="L1"><span begin="1s" end="1.5s">One</span> <span begin="1.5s" end="2s">look</span>
          <span ttm:role="x-bg"><span begin="2s" end="3s">(gachi)</span></span>
        </text>
        <text for="L2"><span begin="4s" end="5s">murihaedo</span> <span begin="5s" end="6s">Can't touch that</span>
          <span ttm:role="x-bg"><span begin="6s" end="7s">(Can't touch that)</span></span>
          <span ttm:role="x-bg"><span begin="7s" end="8s">(gachi)</span></span>
        </text>
      </transliteration></transliterations>`,
      `<p begin="1s" end="3s" itunes:key="L1">
        <span begin="1s" end="1.5s">One</span> <span begin="1.5s" end="2s">look</span>
        <span ttm:role="x-bg"><span begin="2s" end="3s">(같이)</span></span>
      </p>
      <p begin="4s" end="8s" itunes:key="L2">
        <span begin="4s" end="5s">무리해도</span> <span begin="5s" end="6s">Can't touch that</span>
        <span ttm:role="x-bg"><span begin="6s" end="7s">(Can't touch that)</span></span>
        <span ttm:role="x-bg"><span begin="7s" end="8s">(같이)</span></span>
      </p>`,
    );
    const { lines } = parse(xml, { preferredLang: "zh-CN" });

    expect(lines[0].romanLyric).toBe("");
    expect(lines[0].words.map((word) => word.romanWord)).toEqual([undefined, undefined]);
    expect(lines[1]).toMatchObject({ isBG: true, romanLyric: "gachi" });
    expect(lines[1].words[0].romanWord).toBe("gachi");
    expect(lines[2]).toMatchObject({
      translatedLyric: "主句简译",
      romanLyric: "murihaedo Can't touch that",
    });
    expect(lines[2].words.map((word) => word.romanWord)).toEqual(["murihaedo", "Can't touch that"]);
    expect(lines[3]).toMatchObject({ isBG: true, translatedLyric: "碰不到", romanLyric: "" });
    expect(lines[3].words[0].romanWord).toBeUndefined();
    expect(lines[4]).toMatchObject({ isBG: true, translatedLyric: "一起", romanLyric: "gachi" });
    expect(lines[4].words[0].romanWord).toBe("gachi");
  });

  it("无逐字时间的行内音译也按主行及单条背景行比较，并规范化空白与背景括号", () => {
    const xml = wrap(
      "",
      `<p begin="1s" end="2s">One   look<span ttm:role="x-roman">One look</span>
        <span ttm:role="x-bg">（같이）<span ttm:role="x-roman">gachi</span></span>
      </p>
      <p begin="3s" end="4s">무리해도 Can't<span ttm:role="x-roman">murihaedo Can't</span>
        <span ttm:role="x-bg">（Can't）<span ttm:role="x-roman">Can't</span></span>
        <span ttm:role="x-bg">(같이)<span ttm:role="x-roman">gachi</span></span>
      </p>`,
    );
    const { lines } = parse(xml);

    expect(lines.map((line) => line.romanLyric)).toEqual([
      "",
      "gachi",
      "murihaedo Can't",
      "",
      "gachi",
    ]);
    expect(lines[3].words[0].word).toBe("Can't");
  });

  it.each(["sidecar", "inline"])(
    "%s 翻译与原文完全相同时按主行及单条背景行屏蔽",
    (source) => {
      const inline = source === "inline";
      const xml = wrap(
        inline
          ? ""
          : `<translations><translation type="subtitle" xml:lang="zh-Hans">
              <text for="L1">Same<span ttm:role="x-bg">(一起)</span></text>
              <text for="L2">译文<span ttm:role="x-bg">(Same)</span><span ttm:role="x-bg">(伴唱)</span></text>
            </translation></translations>`,
        `<p begin="1s" end="2s" itunes:key="L1">Same${inline ? '<span ttm:role="x-translation">Same</span>' : ""}
          <span ttm:role="x-bg">(같이)${inline ? '<span ttm:role="x-translation">一起</span>' : ""}</span>
        </p>
        <p begin="3s" end="4s" itunes:key="L2">원문${inline ? '<span ttm:role="x-translation">译文</span>' : ""}
          <span ttm:role="x-bg">（Same）${inline ? '<span ttm:role="x-translation">Same</span>' : ""}</span>
          <span ttm:role="x-bg">(背景)${inline ? '<span ttm:role="x-translation">伴唱</span>' : ""}</span>
        </p>`,
      );
      const { lines } = parse(xml, { preferredLang: "zh-CN" });

      expect(lines.map((line) => line.translatedLyric)).toEqual(["", "一起", "译文", "", "伴唱"]);
    },
  );

  it.each([
    ["One look", "one look"],
    ["One look!", "One look"],
  ])("不把大小写或标点有差异的音译判为完全重复：%s / %s", (original, roman) => {
    const { lines } = parse(
      wrap("", `<p begin="1s" end="2s">${original}<span ttm:role="x-roman">${roman}</span></p>`),
    );
    expect(lines[0].romanLyric).toBe(roman);
  });
});
