import { describe, expect, it } from "vitest";
import { bestExternalIndex, detectFormat } from "../src/parse";

describe("detectFormat & bestExternalIndex", () => {
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

  it("应按照指定优先级挑选最优歌词", () => {
    const list = [
      { format: "lrc" as const },
      { format: "ttml" as const },
      { format: "yrc" as const },
    ];

    expect(bestExternalIndex(list, ["ttml", "yrc", "lrc"])).toBe(1);
    expect(bestExternalIndex(list, ["yrc", "lrc", "ttml"])).toBe(2);
    expect(bestExternalIndex(list, ["srt"])).toBe(0);
    expect(bestExternalIndex([])).toBe(-1);
  });
});
