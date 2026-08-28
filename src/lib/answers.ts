// Helpers for normalizing and comparing answers across the app
export const isAnswered = (ans: unknown): boolean => {
  if (ans === undefined || ans === null) return false;
  // treat empty string as unanswered
  if (String(ans).trim() === "") return false;
  const n = Number(ans);
  return !Number.isNaN(n) && n >= 0;
};

export const isAnswerCorrect = (ans: unknown, correctAnswer: unknown): boolean => {
  if (!isAnswered(ans)) return false;
  const a = Number(ans);
  const c = Number(correctAnswer);
  if (Number.isNaN(a) || Number.isNaN(c)) return false;
  return a === c;
};

export const normalizeQuestionTime = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

export const getQuestionRemark = (isCorrect: boolean, timeTaken: number, answered = true) => {
  if (!answered || !isCorrect) return "Needs practice";
  if (timeTaken <= 30) return "Excellent";
  if (timeTaken <= 60) return "Very good";
  if (timeTaken <= 120) return "Good";
  return "Well done";
};

export default {
  isAnswered,
  isAnswerCorrect,
  normalizeQuestionTime,
  getQuestionRemark,
};
