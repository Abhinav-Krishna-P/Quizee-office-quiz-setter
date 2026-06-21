// In-memory store for active live sessions, keyed by partyCode
// Structured as:
// {
//   [partyCode]: {
//     state: "lobby" | "question" | "reveal" | "leaderboard" | "ended",
//     currentQuestionIndex: number,
//     questionStartedAt: number (timestamp),
//     connectedParticipantIds: Set<number>, // participant database IDs
//     answerCounts: { 0: number, 1: number, 2: number, 3: number },
//     answersSubmitted: { [participantId]: { optionIndex: number, timeTakenMs: number } }
//   }
// }
const liveSessions = {};

export const getSession = (partyCode) => {
  if (!partyCode) return null;
  const upperCode = partyCode.toUpperCase();
  return liveSessions[upperCode] || null;
};

export const createSessionStore = (partyCode) => {
  const upperCode = partyCode.toUpperCase();
  liveSessions[upperCode] = {
    state: 'lobby',
    currentQuestionIndex: 0,
    questionStartedAt: null,
    connectedParticipantIds: new Set(),
    answerCounts: { 0: 0, 1: 0, 2: 0, 3: 0 },
    answersSubmitted: {}
  };
  return liveSessions[upperCode];
};

export const deleteSessionStore = (partyCode) => {
  const upperCode = partyCode.toUpperCase();
  delete liveSessions[upperCode];
};

export const hasSession = (partyCode) => {
  const upperCode = partyCode.toUpperCase();
  return !!liveSessions[upperCode];
};

export default liveSessions;
