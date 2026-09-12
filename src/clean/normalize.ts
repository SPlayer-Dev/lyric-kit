import type { LyricLine } from "../types";

/**
 * 查找下一个主行（非背景行）的索引
 * @param lines - 歌词行数组
 * @param from - 起始索引（不含）
 * @returns 下一个主行索引，未找到返回 -1
 */
const findNextMain = (lines: LyricLine[], from: number): number => {
  for (let idx = from + 1; idx < lines.length; idx++) {
    if (!lines[idx].isBG) return idx;
  }
  return -1;
};

/**
 * 歌词行规范化处理
 * 包括空格规范化、行/词时间戳同步、连续背景行折叠、背景行时间窗口对齐与非刻意微小重叠修正
 * @param lines - 待规范化的歌词行数组（原地修改）
 * @returns 无返回值（原地修改）
 */
export const normalizeLyricLines = (lines: LyricLine[]): void => {
  // 规范化空格与提炼 endsWithSpace
  for (const line of lines) {
    const cleanedWords: typeof line.words = [];
    for (let wIdx = 0; wIdx < line.words.length; wIdx++) {
      const word = line.words[wIdx];
      const rawText = word.word;
      if (!rawText.trim()) {
        if (cleanedWords.length > 0) {
          cleanedWords[cleanedWords.length - 1].endsWithSpace = true;
        }
        continue;
      }

      const startsWithSpace = /^\s/.test(rawText);
      const endsWithSpace = /\s$/.test(rawText) || word.endsWithSpace;
      const cleanWord = rawText.trim().replace(/\s+/g, " ");

      if (startsWithSpace && cleanedWords.length > 0) {
        cleanedWords[cleanedWords.length - 1].endsWithSpace = true;
      }

      word.word = cleanWord;
      word.endsWithSpace = endsWithSpace || undefined;
      cleanedWords.push(word);
    }

    if (cleanedWords.length > 0) {
      delete cleanedWords[cleanedWords.length - 1].endsWithSpace;
    }
    line.words = cleanedWords;
  }

  // 同步行/词时间戳
  for (const line of lines) {
    const words = line.words;
    if (
      words.length === 1 &&
      words[0].startTime === 0 &&
      words[0].endTime === 0 &&
      (line.startTime !== 0 || line.endTime !== 0)
    ) {
      words[0].startTime = line.startTime;
      words[0].endTime = line.endTime;
    } else if (words.length > 0) {
      line.startTime = words[0].startTime;
      line.endTime = words[words.length - 1].endTime;
    }
  }

  // 连续背景行折叠
  let consecutiveBg = 0;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (line.isBG) {
      if (lineIdx === 0 || ++consecutiveBg > 1) line.isBG = false;
    } else {
      consecutiveBg = 0;
    }
  }

  // 同步主行与紧随背景行的时间窗口
  for (let lineIdx = lines.length - 1; lineIdx >= 0; lineIdx--) {
    const line = lines[lineIdx];
    if (line.isBG) continue;

    const bg = lines[lineIdx + 1];
    if (!bg?.isBG) continue;

    const allWords = [...line.words, ...bg.words].filter((word) => word.word.trim().length > 0);
    if (allWords.length === 0) continue;

    let minStart = line.startTime;
    let maxEnd = line.endTime;
    for (const word of allWords) {
      if (word.startTime < minStart) minStart = word.startTime;
      if (word.endTime > maxEnd) maxEnd = word.endTime;
    }
    minStart = Math.min(minStart, bg.startTime);
    maxEnd = Math.max(maxEnd, bg.endTime);

    line.startTime = bg.startTime = minStart;
    line.endTime = bg.endTime = maxEnd;
  }

  // 修正非刻意重叠（≤100ms 或不足下一行时长 10% 的重叠视作时间误差）
  for (let lineIdx = 0; lineIdx < lines.length - 1; lineIdx++) {
    const line = lines[lineIdx];
    if (line.isBG) continue;

    const nextIdx = findNextMain(lines, lineIdx);
    if (nextIdx === -1) continue;

    const nextLine = lines[nextIdx];
    const overlap = line.endTime - nextLine.startTime;
    if (overlap <= 0) continue;

    const nextDur = nextLine.endTime - nextLine.startTime;
    if (overlap > 100 && overlap > nextDur * 0.1) continue;

    line.endTime = nextLine.startTime;
    const attachedBg = lines[lineIdx + 1];
    if (attachedBg?.isBG) attachedBg.endTime = nextLine.startTime;
  }
};
