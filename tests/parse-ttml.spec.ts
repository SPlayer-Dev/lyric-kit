import { describe, expect, it } from "vitest";
import { parseTTML } from "../src/parse";

describe("parseTTML", () => {
  it("应解析基础逐字 span 及对唱 agent", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <head>
    <metadata>
      <ttm:agent xml:id="v1" type="person"/>
      <ttm:agent xml:id="v2" type="person"/>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:01.000" end="00:03.000" ttm:agent="v1">
        <span begin="00:01.000" end="00:02.000">Hello</span>
        <span begin="00:02.000" end="00:03.000">World</span>
      </p>
      <p begin="00:04.000" end="00:06.000" ttm:agent="v2">
        <span begin="00:04.000" end="00:06.000">Duet</span>
      </p>
    </div>
  </body>
</tt>`;
    const lines = parseTTML(xml);

    expect(lines).toHaveLength(2);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(3000);
    expect(lines[0].isDuet).toBe(false);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello");

    expect(lines[1].startTime).toBe(4000);
    expect(lines[1].isDuet).toBe(true);
  });

  it("应解析 iTunes 翻译元数据", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <head>
    <metadata>
      <translations>
        <translation xml:lang="zh-CN">
          <text for="line1">你好世界</text>
        </translation>
      </translations>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:01.000" end="00:02.000" key="line1">
        <span begin="00:01.000" end="00:02.000">Hello</span>
      </p>
    </div>
  </body>
</tt>`;
    const lines = parseTTML(xml, "zh-CN");

    expect(lines).toHaveLength(1);
    expect(lines[0].translatedLyric).toBe("你好世界");
  });
});
