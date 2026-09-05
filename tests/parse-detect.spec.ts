import { describe, expect, it } from "vitest";
import { normalizeKangxi } from "../src/clean/kangxi";
import { detectFormat, parseLRC, parseLyric, parseQRC } from "../src/parse";

describe("detectFormat", () => {
  it("应根据歌词特征正确识别格式", () => {
    expect(detectFormat("[00:01.00]标准歌词")).toBe("lrc");
    expect(detectFormat("1\n00:00:01,000 --> 00:00:02,000\n字幕歌词")).toBe("srt");
    expect(detectFormat('<tt xmlns="http://www.w3.org/ns/ttml"><body></body></tt>')).toBe("ttml");
    expect(detectFormat("[1000,500](1000,500,0)网易云逐字")).toBe("yrc");
    expect(detectFormat("[1000,500]QQ音乐逐字(1000,500)")).toBe("qrc");
    expect(
      detectFormat(
        '<?xml version="1.0"?><QrcInfos><Lyric_1 LyricContent="[0,100]测试(0,100)"/></QrcInfos>',
      ),
    ).toBe("qrc");
    expect(detectFormat("[1]LyS格式(1000,500)")).toBe("lys");
    expect(detectFormat("[Script Info]\nTitle: Test ASS")).toBe("ass");
    expect(detectFormat("[00:01.000]<0,500>酷<500,500>狗")).toBe("krc");
    expect(detectFormat("[id:$00000000]\n[1000,1000]<0,500,0>测")).toBe("krc");
  });
});

describe("normalizeKangxi & cleanKangxi", () => {
  it("作为独立清洗函数能正确还原字符", () => {
    expect(normalizeKangxi("\u2F00\u2F49")).toBe("一月");
  });

  it("parseLyric 默认不进行康熙部首转换", () => {
    const kangxiLrc = "[00:01.00]\u2F00\u2F49\n[00:02.00]标准文本";
    const resDefault = parseLyric(kangxiLrc);
    expect(resDefault.lines[0].words[0].word).toBe("\u2F00\u2F49");

    const resFalse = parseLyric(kangxiLrc, { cleanKangxi: false });
    expect(resFalse.lines[0].words[0].word).toBe("\u2F00\u2F49");
  });

  it("parseLyric 显式配置 cleanKangxi: true 时正确还原为标准汉字", () => {
    const kangxiLrc = "[00:01.00]\u2F00\u2F49\n[00:02.00]标准文本";
    const kangxiTrans = "[00:01.00]\u2F00月翻译";
    const kangxiRoma = "[00:01.00]\u2F00月音译";

    const res = parseLyric(
      {
        content: kangxiLrc,
        translation: kangxiTrans,
        romaji: kangxiRoma,
      },
      { cleanKangxi: true },
    );

    expect(res.lines[0].words[0].word).toBe("一月");
    expect(res.lines[0].translatedLyric).toBe("一月翻译");
    expect(res.lines[0].romanLyric).toBe("一月音译");
  });

  it("单独导入具体解析器（如 parseLRC / parseQRC）时也能直接生效 cleanKangxi", () => {
    const kangxiLrc = "[00:01.00]\u2F00\u2F49";
    expect(parseLRC(kangxiLrc).lines[0].words[0].word).toBe("\u2F00\u2F49");
    expect(parseLRC(kangxiLrc, { cleanKangxi: true }).lines[0].words[0].word).toBe("一月");

    const kangxiQrc = "[0,1000]\u2F00(0,500)\u2F49(500,500)";
    expect(parseQRC(kangxiQrc).lines[0].words[0].word).toBe("\u2F00");
    expect(parseQRC(kangxiQrc, { cleanKangxi: true }).lines[0].words[0].word).toBe("一");
  });
});
