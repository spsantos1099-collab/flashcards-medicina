import type { Difficulty, ExtractedDocument, Flashcard } from "../types";

export interface ExamAlternative {
  letter: string;
  text: string;
  correct: boolean;
}

export interface ParsedExamQuestion {
  id: string;
  code: string;
  number: number;
  examId: string;
  booklet: string;
  pageStart: number;
  pageEnd: number;
  question: string;
  alternatives: ExamAlternative[];
  correctLetter: string;
  correctAnswer: string;
  explanation: string;
  difficulty: Difficulty;
  topic: string;
  subarea: string;
  dependsOnImage: boolean;
  imageReason?: string;
}

export interface ExamParseResult {
  totalQuestions: number;
  uniqueQuestions: number;
  duplicateQuestions: number;
  imageDependentQuestions: number;
  invalidQuestions: number;
  usableQuestions: ParsedExamQuestion[];
  discardedImageQuestions: ParsedExamQuestion[];
}

const QUESTION_HEADER = /^(\d{1,3})\s*[ªºa]?\s*QUEST[ÃA]O\s*$/gim;
const EXAM_HEADER = /^PROVA\s+(\d+)\s*-\s*CADERNO\s+([0-9A-Z]+)\s*$/gim;
const PAGE_MARKER = /\[\[PAGE:(\d+)\]\]/g;

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanExtractedText(value: string) {
  return normalizeWhitespace(value)
    .replace(/\[\[PAGE:\d+\]\]/g, " ")
    .replace(/\b\d{6,}\.[0-9A-Za-z.]+\b/g, " ")
    .replace(/P[áa]?gina\s+\d+\s+de\s+\d+/gi, " ")
    .replace(/acervo\.top\s*\/\s*acervotop\.com/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pageAtPosition(value: string, position: number) {
  PAGE_MARKER.lastIndex = 0;
  let page = 1;
  let match: RegExpExecArray | null;
  while ((match = PAGE_MARKER.exec(value)) && match.index < position) {
    page = Number(match[1] || page);
  }
  PAGE_MARKER.lastIndex = 0;
  return page;
}

function textBetween(block: string, startPattern: RegExp, endPatterns: RegExp[]) {
  const start = startPattern.exec(block);
  startPattern.lastIndex = 0;
  if (!start) return "";
  const startIndex = start.index + start[0].length;
  const tail = block.slice(startIndex);
  const endIndexes = endPatterns
    .map((pattern) => {
      const match = pattern.exec(tail);
      pattern.lastIndex = 0;
      return match ? match.index : -1;
    })
    .filter((index) => index >= 0);
  const endIndex = endIndexes.length ? Math.min(...endIndexes) : tail.length;
  return cleanExtractedText(tail.slice(0, endIndex));
}

function mapDifficulty(value: string): Difficulty {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("facil")) return "easy";
  if (normalized.includes("dificil")) return "hard";
  return "medium";
}

function findImageDependency(question: string) {
  const patterns: Array<{ regex: RegExp; reason: string }> = [
    { regex: /\b(?:figura|imagem|gr[aá]fico|radiografia|tomografia|tra[cç]ado)\s+(?:abaixo|a seguir|acima|ao lado)\b/i, reason: "depende de figura, imagem, gráfico ou traçado" },
    { regex: /\bcomo\s+(?:mostra|ilustra|demonstrad[oa])\s+(?:a\s+)?(?:figura|imagem|gr[aá]fico)\b/i, reason: "depende de figura ou imagem" },
    { regex: /\bapresenta\s+(?:o\s+)?seguinte\s+tra[cç]ado\b/i, reason: "depende de traçado" },
    { regex: /\bnomograma\s+de\b/i, reason: "depende de nomograma" },
    { regex: /\b(?:de acordo|conforme)\s+com\s+(?:o|a)\s+(?:gr[aá]fico|figura|imagem|nomograma)\b/i, reason: "depende de elemento visual" },
  ];

  const found = patterns.find((item) => item.regex.test(question));
  return found ? found.reason : null;
}

function stripInstitutionPrefix(value: string) {
  return value.replace(/^\([^)]{2,80}\)\s*/, "").trim();
}

function sectionValue(block: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`\\[${escaped}\\]\\s*([\\s\\S]*?)(?=\\n\\[[^\\]]+\\]|$)`, "i").exec(block);
  return match ? cleanExtractedText(match[1] || "") : "";
}

function findCorrectExplanation(
  response: string,
  alternatives: ExamAlternative[],
  correctAnswer: string,
) {
  const cleanedResponse = cleanExtractedText(response);
  if (!cleanedResponse) return "";

  const positions = alternatives
    .map((alternative) => {
      const probe = cleanExtractedText(alternative.text).slice(0, 120).toLowerCase();
      const index = probe.length >= 20 ? cleanedResponse.toLowerCase().indexOf(probe) : -1;
      return { alternative, index };
    })
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);

  const correctPosition = positions.find((item) => item.alternative.correct);
  if (correctPosition) {
    const nextPosition = positions.find((item) => item.index > correctPosition.index);
    const segment = cleanedResponse.slice(correctPosition.index, nextPosition?.index ?? cleanedResponse.length).trim();
    if (segment.length >= 30) return segment.slice(0, 1600);
  }

  const answerProbe = cleanExtractedText(correctAnswer).slice(0, 100).toLowerCase();
  const answerIndex = answerProbe.length >= 20 ? cleanedResponse.toLowerCase().indexOf(answerProbe) : -1;
  if (answerIndex >= 0) return cleanedResponse.slice(answerIndex, answerIndex + 1600).trim();

  return cleanedResponse.slice(0, 1600);
}

function buildQuestionId(examId: string, code: string, number: number) {
  return `exam-${examId || "unknown"}-${code || number}`;
}

function questionQuality(question: ParsedExamQuestion) {
  return (
    question.explanation.length +
    question.topic.length * 6 +
    question.subarea.length * 4 +
    question.alternatives.length * 30
  );
}

export function parseExamDocument(document: ExtractedDocument): ExamParseResult {
  if (document.extension !== "pdf" || document.pages.length === 0) {
    return {
      totalQuestions: 0,
      uniqueQuestions: 0,
      duplicateQuestions: 0,
      imageDependentQuestions: 0,
      invalidQuestions: 0,
      usableQuestions: [],
      discardedImageQuestions: [],
    };
  }

  const joined = document.pages
    .map((page) => `\n[[PAGE:${page.pageNumber}]]\n${page.text}`)
    .join("\n");

  QUESTION_HEADER.lastIndex = 0;
  EXAM_HEADER.lastIndex = 0;
  const questionMatches = Array.from(joined.matchAll(QUESTION_HEADER));
  const examMatches = Array.from(joined.matchAll(EXAM_HEADER));
  QUESTION_HEADER.lastIndex = 0;
  EXAM_HEADER.lastIndex = 0;

  const parsed: ParsedExamQuestion[] = [];
  let invalidQuestions = 0;

  questionMatches.forEach((questionMatch, index) => {
    const start = questionMatch.index ?? 0;
    const end = questionMatches[index + 1]?.index ?? joined.length;
    const block = joined.slice(start, end);
    const previousExam = [...examMatches]
      .reverse()
      .find((examMatch) => (examMatch.index ?? -1) < start);
    const examId = previousExam?.[1] || "";
    const booklet = previousExam?.[2] || "";
    const number = Number(questionMatch[1] || index + 1);
    const code = /C[oó]digo da quest[aã]o:\s*([0-9]+)/i.exec(block)?.[1] || "";
    const question = stripInstitutionPrefix(textBetween(
      block,
      /Enunciado:\s*/i,
      [/\nAlternativas:\s*/i, /\nGrau de dificuldade:/i],
    ));

    const alternativeArea = /Alternativas:\s*([\s\S]*?)(?=\nGrau de dificuldade:)/i.exec(block)?.[1] || "";
    const alternatives: ExamAlternative[] = [];
    const alternativePattern = /\(alternativa\s+([A-Z])\)\s*(\(CORRETA\))?\s*([\s\S]*?)(?=\(alternativa\s+[A-Z]\)|$)/gi;
    let alternativeMatch: RegExpExecArray | null;
    while ((alternativeMatch = alternativePattern.exec(alternativeArea))) {
      alternatives.push({
        letter: (alternativeMatch[1] || "").toUpperCase(),
        correct: Boolean(alternativeMatch[2]),
        text: cleanExtractedText(alternativeMatch[3] || ""),
      });
    }

    const correctAlternatives = alternatives.filter((alternative) => alternative.correct && alternative.text);
    const difficultyRaw = /Grau de dificuldade:\s*(F[aá]cil|M[eé]dio|Dif[ií]cil)/i.exec(block)?.[1] || "Médio";
    const rawResponse = textBetween(
      block,
      /Resposta comentada:\s*/i,
      [/\nRefer[eê]ncias?:/i, /\nFeedback:/i, /\nFiltros da quest[aã]o:/i],
    );
    const topic = sectionValue(block, "Tema");
    const subarea = sectionValue(block, "Subáreas de Conhecimento");
    const pageStart = pageAtPosition(joined, start);
    const pageEnd = pageAtPosition(joined, end);
    const imageReason = findImageDependency(question);

    if (!question || !code || correctAlternatives.length !== 1) {
      invalidQuestions += 1;
      return;
    }

    const correctAlternative = correctAlternatives[0];
    const parsedQuestion: ParsedExamQuestion = {
      id: buildQuestionId(examId, code, number),
      code,
      number,
      examId,
      booklet,
      pageStart,
      pageEnd: Math.max(pageStart, pageEnd),
      question,
      alternatives,
      correctLetter: correctAlternative.letter,
      correctAnswer: correctAlternative.text,
      explanation: findCorrectExplanation(rawResponse, alternatives, correctAlternative.text),
      difficulty: mapDifficulty(difficultyRaw),
      topic: topic || subarea || "Revisão de prova",
      subarea,
      dependsOnImage: Boolean(imageReason),
      imageReason: imageReason || undefined,
    };
    parsed.push(parsedQuestion);
  });

  const bestByKey = new Map<string, ParsedExamQuestion>();
  parsed.forEach((question) => {
    const key = question.code || cleanExtractedText(question.question).toLowerCase();
    const current = bestByKey.get(key);
    if (!current || questionQuality(question) > questionQuality(current)) bestByKey.set(key, question);
  });

  const unique = Array.from(bestByKey.values());
  const discardedImageQuestions = unique.filter((question) => question.dependsOnImage);
  const usableQuestions = unique.filter((question) => !question.dependsOnImage);

  return {
    totalQuestions: questionMatches.length,
    uniqueQuestions: unique.length,
    duplicateQuestions: Math.max(0, parsed.length - unique.length),
    imageDependentQuestions: discardedImageQuestions.length,
    invalidQuestions,
    usableQuestions,
    discardedImageQuestions,
  };
}

function tempId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function looksLikeClinicalCase(question: string) {
  return /\b(?:paciente|crian[cç]a|lactente|rec[eé]m-nascido|neonato|adolescente|menino|menina|gestante|mulher|homem)\b/i.test(question)
    && question.length >= 180;
}

export interface SimplifiedExamCardContent {
  code: string;
  topic: string;
  question: string;
  answer: string;
  explanation: string;
}

export function examQuestionsToFlashcards(
  questions: ParsedExamQuestion[],
  deckId: string,
  documentId: string,
  documentName: string,
  options?: {
    style?: "faithful" | "memorization";
    simplified?: SimplifiedExamCardContent[];
  },
): Flashcard[] {
  const now = new Date().toISOString();
  const style = options?.style || "faithful";
  const simplifiedByCode = new Map((options?.simplified || []).map((item) => [item.code, item]));

  return questions.map((question) => {
    const simplified = style === "memorization" ? simplifiedByCode.get(question.code) : undefined;
    const cardQuestion = simplified?.question || question.question;
    const cardAnswer = simplified?.answer || question.correctAnswer;
    const cardExplanation = simplified?.explanation || question.explanation || undefined;
    const cardTopic = style === "memorization" && simplified?.topic
      ? simplified.topic
      : question.topic;

    return {
      id: tempId(`exam-${question.code}`),
      deckId,
      type: style === "memorization" ? "basic" : looksLikeClinicalCase(question.question) ? "clinical_case" : "basic",
      question: cardQuestion,
      answer: cardAnswer,
      explanation: cardExplanation || undefined,
      topic: cardTopic,
      tags: [
        "modo-prova",
        style === "memorization" ? "memorizacao-rapida" : "fiel-a-prova",
        question.examId ? `prova-${question.examId}` : "prova",
        `questao-${question.code}`,
        question.subarea,
      ].filter(Boolean).slice(0, 6),
      difficulty: question.difficulty,
      learningObjective: `${style === "memorization" ? "exam-memory" : "exam"}:${question.code}:${question.correctAnswer.slice(0, 100)}`,
      sources: [{
        id: tempId(`source-exam-${question.code}`),
        kind: "upload",
        title: documentName,
        provider: question.examId ? `Prova ${question.examId}` : "Prova importada",
        documentId,
        page: question.pageStart,
        section: `${question.examId ? `Prova ${question.examId} · ` : ""}Questão ${question.number} · Código ${question.code}`,
        excerpt: `Resposta correta (${question.correctLetter}): ${question.correctAnswer}`,
        verificationStatus: "user_material",
        supports: question.correctAnswer,
      }],
      createdAt: now,
      updatedAt: now,
    };
  });
}
