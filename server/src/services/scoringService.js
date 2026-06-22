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

  return {
    points: 20,
    streakReset: false
  };
}

