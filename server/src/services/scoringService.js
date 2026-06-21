const BASE_POINTS = 1000;

/**
 * Calculates points earned for a question answer.
 * @param {boolean} isCorrect - Whether the submitted answer is correct
 * @param {number} timeTakenMs - Time taken in milliseconds
 * @param {number} timeLimitSec - Question time limit in seconds
 * @param {number} currentStreak - Current consecutive correct answers before this one
 * @param {boolean} applyStreakBonus - Whether streak bonus is enabled
 * @returns {object} { points: number, streakReset: boolean }
 */
export function calculatePoints(isCorrect, timeTakenMs, timeLimitSec, currentStreak = 0, applyStreakBonus = false) {
  if (!isCorrect) {
    return { points: 0, streakReset: true };
  }

  const timeLimitMs = timeLimitSec * 1000;
  
  // Bound speed ratio between 0 and 1
  let speedRatio = timeTakenMs / timeLimitMs;
  if (isNaN(speedRatio) || speedRatio < 0) speedRatio = 0;
  if (speedRatio > 1) speedRatio = 1;

  // speed_ratio = 0 -> 100% of BASE_POINTS
  // speed_ratio = 1 -> 50% of BASE_POINTS
  let points = Math.round(BASE_POINTS * (1 - speedRatio * 0.5));
  
  if (applyStreakBonus && currentStreak > 0) {
    points += (currentStreak * 50); // e.g. 1st streak is +50, 2nd is +100, etc.
  }

  return {
    points,
    streakReset: false
  };
}
