import { describe, expect, it } from "vitest";
import type { LyricLine } from "../src/types";
import { getWordSweepProgress } from "../src/utils/sweep";
import {
  clampLastLineEnd,
  findActiveLyricIndices,
  findLyricIndex,
  pickLatestStartedIndex,
} from "../src/utils/sync";

const lines: LyricLine[] = [
  {
    startTime: 1000,
    endTime: 3000,
    words: [{ startTime: 1000, endTime: 3000, word: "Line 1" }],
    translatedLyric: "",
    romanLyric: "",
    isBG: false,
    isDuet: false,
  },
  {
    startTime: 2500, // 与 Line 1 稍有重叠（如背景音或和声）
    endTime: 4000,
    words: [{ startTime: 2500, endTime: 4000, word: "BG Line" }],
    translatedLyric: "",
    romanLyric: "",
    isBG: true,
    isDuet: false,
  },
  {
    startTime: 4000,
    endTime: 6000,
    words: [{ startTime: 4000, endTime: 6000, word: "Line 2" }],
    translatedLyric: "",
    romanLyric: "",
    isBG: false,
    isDuet: false,
  },
];

describe("sync utils", () => {
  it("findLyricIndex 应通过二分查找命中当前主歌词行", () => {
    expect(findLyricIndex(lines, 500)).toBe(-1);
    expect(findLyricIndex(lines, 1500)).toBe(0);
    expect(findLyricIndex(lines, 3500)).toBe(1);
    expect(findLyricIndex(lines, 4500)).toBe(2);
  });

  it("findActiveLyricIndices 应返回所有处于播放区间的行下标", () => {
    // 2600ms 处于 Line 1 (1000-3000) 和 BG Line (2500-4000) 的交叠区
    const active = findActiveLyricIndices(lines, 2600);
    expect(active).toEqual([0, 1]);
  });

  it("pickLatestStartedIndex 应返回最大 startTime <= time 的索引", () => {
    expect(pickLatestStartedIndex(lines, 2800)).toBe(1);
    expect(pickLatestStartedIndex(lines, 5000)).toBe(2);
  });

  it("getWordSweepProgress 具有 preRoll 提前平滑特性", () => {
    const word = { startTime: 1000, endTime: 2000 };
    // 800ms 时还未到 preRoll 提前量 (80ms)，进度为 0
    expect(getWordSweepProgress(word, 0, 800)).toBe(0);
    // 950ms 进入了 preRoll 区间，进度已经大于 0
    expect(getWordSweepProgress(word, 0, 950)).toBeGreaterThan(0);
    // 1500ms 进度约为 0.5 左右
    expect(getWordSweepProgress(word, 0, 1500)).toBeCloseTo(0.5, 1);
    // 2100ms 超过 endTime，进度封顶 1
    expect(getWordSweepProgress(word, 0, 2100)).toBe(1);
  });

  it("clampLastLineEnd 应修整最后一行过长或无效的 endTime", () => {
    const testLines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 9999999,
        words: [{ startTime: 1000, endTime: 9999999, word: "End" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
    ];

    const clamped = clampLastLineEnd(testLines, 10000);
    expect(clamped[0].endTime).toBe(10000);
  });
});
