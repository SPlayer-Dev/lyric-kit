/**
 * 计算单词的逐字扫动进度 [0, 1]
 *
 * 含与应用内引擎一致的 preRoll 提前量：每个词在 startTime 之前提前开始扫动，
 * 让相邻词亮区衔接而非硬切，也使外部歌词与应用内的起亮时刻对齐
 *
 * @param word - 单词时间区间
 * @param lineStartTime - 所属行的起始时间（ms），preRoll 不会越过行首
 * @param currentMs - 当前播放毫秒
 * @returns 扫动进度，0 未开始，1 已完成
 */
export const getWordSweepProgress = (
  word: { startTime: number; endTime: number },
  lineStartTime: number,
  currentMs: number,
): number => {
  const wordDuration = Math.abs(word.endTime - word.startTime) || 1;
  const preRoll = Math.min(80, wordDuration * 0.3);
  const adjustedStart = Math.max(lineStartTime, word.startTime - preRoll);
  const adjustedDuration = Math.max(1, word.endTime - adjustedStart);
  return Math.max(0, Math.min(1, (currentMs - adjustedStart) / adjustedDuration));
};
