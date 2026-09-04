import type { LyricLine } from "../types";

const LAST_LINE_FALLBACK_MS = 8000;

/**
 * 根据播放时间查找当前歌词行索引（二分查找）
 * @param lines 已按 startTime 排序的歌词行数组
 * @param time 当前播放时间（毫秒）
 * @param prevIndex 上一次的索引，用于快速路径优化
 * @returns 匹配的行索引，无匹配返回 -1
 */
export const findLyricIndex = (lines: LyricLine[], time: number, prevIndex = -1): number => {
  if (lines.length === 0) return -1;

  // 快速路径：当前索引仍然有效
  if (prevIndex >= 0 && prevIndex < lines.length) {
    const current = lines[prevIndex];
    if (time >= current.startTime && time < current.endTime) return prevIndex;
    // 检查下一行（正常播放最常见的情况）
    const next = lines[prevIndex + 1];
    if (next && time >= next.startTime && time < next.endTime) return prevIndex + 1;
  }

  // 二分查找：找最后一个 startTime <= time 的行
  let lo = 0;
  let hi = lines.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].startTime <= time) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // 在该行时间范围内，或处于该行 endTime 与下一行 startTime 之间的间隙，都停留在该行
  if (result >= 0) {
    if (time < lines[result].endTime) return result;
    const next = lines[result + 1];
    if (!next || time < next.startTime) return result;
  }

  // 跳过背景歌词行，往前找最近的主歌词行
  while (result >= 0 && lines[result].isBG) result--;

  return result;
};

/**
 * 查找当前时间下所有激活的歌词行索引（支持对唱、背景行等时间重叠场景）
 * @param lines 已按 startTime 排序的歌词行数组
 * @param time 当前播放时间（毫秒）
 * @returns 所有 startTime <= time < endTime 的行索引
 */
export const findActiveLyricIndices = (lines: LyricLine[], time: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (time >= line.startTime && time < line.endTime) result.push(i);
    else if (line.startTime > time) break;
  }
  return result;
};

/**
 * 选出「最新已开始」的行索引（startTime <= time 的最大下标）
 * 下一句一开始就切到下一句，不管上一句是否结束
 * @param lines 歌词行数组
 * @param time 当前播放毫秒
 */
export const pickLatestStartedIndex = (lines: LyricLine[], time: number): number => {
  if (lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].startTime <= time) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
};

/**
 * 提前切到下一行（当前行结束后立即跳到下一行）
 * @param lines 歌词行数组
 * @param time 当前播放毫秒
 */
export const pickAdvanceOnEndIndex = (lines: LyricLine[], time: number): number => {
  const idx = pickLatestStartedIndex(lines, time);
  if (idx >= 0 && idx + 1 < lines.length && lines[idx].endTime <= time) {
    return idx + 1;
  }
  return idx;
};

/**
 * 选出当前应作为 primary 的行索引（考虑重叠与平滑切换）
 * @param lines 歌词行数组
 * @param time 当前播放毫秒
 */
export const pickPrimaryIndex = (lines: LyricLine[], time: number): number => {
  if (lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let latest = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].startTime <= time) {
      latest = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (latest < 0) return -1;
  const latestActive = time < lines[latest].endTime;
  if (!latestActive) return latest;
  if (latest > 0) {
    const prev = lines[latest - 1];
    if (prev.startTime <= time && time < prev.endTime) return latest - 1;
  }
  return latest;
};

/**
 * 将最后一行无效 endTime 截到曲目时长或 startTime+8s
 * @param lines 歌词行数组
 * @param trackDurationMs 曲目时长 ms
 */
export const clampLastLineEnd = (lines: LyricLine[], trackDurationMs?: number): LyricLine[] => {
  if (lines.length === 0) return lines;
  const last = lines[lines.length - 1];
  const reasonable =
    typeof trackDurationMs === "number" && trackDurationMs > last.startTime
      ? trackDurationMs
      : last.startTime + LAST_LINE_FALLBACK_MS;
  if (last.endTime <= reasonable) return lines;
  const clamped: LyricLine = {
    ...last,
    endTime: reasonable,
    words: last.words.map((w, i, arr) =>
      i === arr.length - 1 && w.endTime > reasonable ? { ...w, endTime: reasonable } : w,
    ),
  };
  return [...lines.slice(0, -1), clamped];
};
