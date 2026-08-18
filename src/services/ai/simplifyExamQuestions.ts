import type { User } from "firebase/auth";
import type { ParsedExamQuestion } from "../../lib/examParser";

const BATCH_SIZE = 8;
const MAX_ATTEMPTS = 3;

export interface SimplifiedExamQuestion {
  code: string;
  topic: string;
  question: string;
  answer: string;
  explanation: string;
}

interface SimplifyResponse {
  cards?: SimplifiedExamQuestion[];
  error?: string;
  code?: string;
  transient?: boolean;
}

export class ExamSimplificationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly transient = false,
  ) {
    super(message);
    this.name = "ExamSimplificationError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function chunkQuestions(questions: ParsedExamQuestion[]) {
  const chunks: ParsedExamQuestion[][] = [];
  for (let index = 0; index < questions.length; index += BATCH_SIZE) {
    chunks.push(questions.slice(index, index + BATCH_SIZE));
  }
  return chunks;
}

function normalizeResult(card: SimplifiedExamQuestion) {
  return {
    code: String(card.code || "").trim(),
    topic: String(card.topic || "").trim(),
    question: String(card.question || "").trim(),
    answer: String(card.answer || "").trim(),
    explanation: String(card.explanation || "").trim(),
  };
}

async function requestBatch(user: User, questions: ParsedExamQuestion[]) {
  const idToken = await user.getIdToken();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch("/.netlify/functions/simplify-exam-cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          questions: questions.map((question) => ({
            code: question.code,
            question: question.question,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            difficulty: question.difficulty,
          })),
        }),
      });
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(900 * attempt);
        continue;
      }
      throw new ExamSimplificationError(
        "Não foi possível alcançar a IA para simplificar os cards. Você pode tentar novamente ou usar o formato fiel à prova.",
        "network_error",
        true,
      );
    }

    let data: SimplifyResponse = {};
    try {
      data = await response.json() as SimplifyResponse;
    } catch {
      // handled below
    }

    if (!response.ok) {
      const transient = data.transient === true || response.status === 429 || response.status >= 500;
      if (transient && attempt < MAX_ATTEMPTS) {
        await sleep(response.status === 429 ? 1800 * attempt : 900 * attempt);
        continue;
      }
      throw new ExamSimplificationError(
        data.error || "Não foi possível simplificar os cards agora.",
        data.code || `http_${response.status}`,
        transient,
      );
    }

    const cards = Array.isArray(data.cards) ? data.cards.map(normalizeResult) : [];
    const byCode = new Map(cards.filter((card) => card.code && card.topic && card.question && card.answer).map((card) => [card.code, card]));
    const missing = questions.filter((question) => !byCode.has(question.code));
    if (missing.length > 0) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(700 * attempt);
        continue;
      }
      throw new ExamSimplificationError(
        "A IA não conseguiu simplificar todas as questões selecionadas. Tente novamente ou use o formato fiel à prova.",
        "incomplete_response",
        true,
      );
    }

    return questions.map((question) => byCode.get(question.code) as SimplifiedExamQuestion);
  }

  throw new ExamSimplificationError("Não foi possível simplificar os cards.", "unknown_error", true);
}

export async function simplifyExamQuestions({
  user,
  questions,
  onProgress,
}: {
  user: User;
  questions: ParsedExamQuestion[];
  onProgress?: (completed: number, total: number) => void;
}) {
  const batches = chunkQuestions(questions);
  const result: SimplifiedExamQuestion[] = [];
  let completed = 0;
  onProgress?.(0, questions.length);

  for (const batch of batches) {
    const cards = await requestBatch(user, batch);
    result.push(...cards);
    completed += batch.length;
    onProgress?.(completed, questions.length);
  }

  return result;
}
