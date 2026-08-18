import type { User } from "firebase/auth";
import { onValue, push, ref, remove, set, type DataSnapshot } from "firebase/database";
import { database } from "../../lib/firebase";
import type {
  CardSource,
  CardType,
  Deck,
  Difficulty,
  ExtractedDocument,
  Flashcard,
  GenerationMeta,
  GenerationOptions,
} from "../../types";

const MAX_DOCUMENT_CHARACTERS = 120_000;
const BACKGROUND_WAIT_MS = 15 * 60 * 1000 + 30_000;

interface ApiEvidence {
  sourcePage: number;
  sourceExcerpt: string;
}

interface ApiCard {
  type: CardType;
  learningObjective: string;
  question: string;
  answer: string;
  explanation: string;
  topic: string;
  tags: string[];
  difficulty: Difficulty;
  evidences: ApiEvidence[];
}

interface BackgroundResult {
  cards: ApiCard[];
  meta: GenerationMeta;
}

interface GenerationJobRecord {
  status: "queued" | "processing" | "complete" | "error";
  stage?: string;
  stageLabel?: string;
  targetCards?: number;
  generatedCards?: number;
  retryAttempt?: number | null;
  refillRound?: number | null;
  result?: BackgroundResult;
  errorMessage?: string | null;
}

export interface GenerationProgress {
  completedBatches: number;
  totalBatches: number;
  generatedCards: number;
  targetCards: number;
  stage: "generating" | "validating" | "refill" | "retrying";
  currentType?: CardType;
  refillRound?: number;
  retryAttempt?: number;
  label?: string;
}

export class AIGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly transient = false,
  ) {
    super(message);
    this.name = "AIGenerationError";
  }
}

function temporaryId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeSource(document: ExtractedDocument, evidence: ApiEvidence): CardSource {
  const page = document.extension === "pdf" && evidence.sourcePage > 0
    ? evidence.sourcePage
    : undefined;

  return {
    id: temporaryId("source"),
    kind: "upload",
    title: document.name,
    documentId: document.documentId,
    page,
    excerpt: evidence.sourceExcerpt.trim(),
    verificationStatus: "user_material",
  };
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[²₂]/g, "2")
    .replace(/[³₃]/g, "3")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function cleanClozeAnswer(answer: string, question: string) {
  const values = [...question.matchAll(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
  if (/\{\{c\d+::/.test(answer) || normalizeText(answer) === normalizeText(question)) {
    return values.length ? values.join("; ") : answer.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, "$1").trim();
  }
  return answer.trim();
}

function mapCard(deck: Deck, document: ExtractedDocument, apiCard: ApiCard, generatedAt: string): Flashcard {
  const evidences = Array.isArray(apiCard.evidences) ? apiCard.evidences : [];
  return {
    id: temporaryId("generated"),
    deckId: deck.id,
    type: apiCard.type,
    learningObjective: apiCard.learningObjective?.trim() || undefined,
    question: apiCard.question.trim(),
    answer: apiCard.type === "cloze"
      ? cleanClozeAnswer(apiCard.answer, apiCard.question)
      : apiCard.answer.trim(),
    explanation: apiCard.explanation.trim() || undefined,
    topic: apiCard.topic.trim() || deck.topic || deck.title,
    tags: Array.isArray(apiCard.tags)
      ? apiCard.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 6)
      : [],
    difficulty: apiCard.difficulty,
    sources: evidences.map((evidence) => normalizeSource(document, evidence)),
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
}

function translateProgress(job: GenerationJobRecord, targetCards: number): GenerationProgress {
  const rawStage = job.stage || "starting";
  let stage: GenerationProgress["stage"] = "generating";
  let currentType: CardType | undefined;

  if (rawStage === "retrying") stage = "retrying";
  else if (rawStage === "validating_clinical") stage = "validating";
  else if (rawStage === "refill") stage = "refill";
  else if (rawStage === "generating_clinical") currentType = "clinical_case";
  else if (rawStage === "generating_cloze") currentType = "cloze";
  else if (rawStage === "generating_basic") currentType = "basic";

  return {
    completedBatches: 0,
    totalBatches: 1,
    generatedCards: Math.min(job.generatedCards ?? 0, targetCards),
    targetCards,
    stage,
    currentType,
    refillRound: job.refillRound ?? undefined,
    retryAttempt: job.retryAttempt ?? undefined,
    label: job.stageLabel || undefined,
  };
}

async function invokeBackgroundJob({
  idToken,
  jobId,
  deck,
  document,
  options,
}: {
  idToken: string;
  jobId: string;
  deck: Deck;
  document: ExtractedDocument;
  options: GenerationOptions;
}) {
  let response: Response;
  try {
    response = await fetch("/.netlify/functions/generate-flashcards-background", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        jobId,
        deck: {
          id: deck.id,
          title: deck.title,
          specialty: deck.specialty,
          topic: deck.topic || "",
        },
        document: {
          id: document.documentId,
          name: document.name,
          extension: document.extension,
          pages: document.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
        },
        options,
      }),
    });
  } catch {
    throw new AIGenerationError(
      "Não foi possível iniciar a geração. Verifique sua conexão e tente novamente.",
      "background_start_network_error",
      true,
    );
  }

  // Background Functions respondem imediatamente com 202. Aceitamos também 200
  // para facilitar testes locais e mudanças de runtime da Netlify.
  if (response.status !== 202 && !response.ok) {
    throw new AIGenerationError(
      "A Netlify não conseguiu iniciar o processamento em segundo plano.",
      `background_start_${response.status}`,
      true,
    );
  }
}

function waitForJob({
  path,
  targetCards,
  onProgress,
}: {
  path: string;
  targetCards: number;
  onProgress?: (progress: GenerationProgress) => void;
}): Promise<BackgroundResult> {
  return new Promise((resolve, reject) => {
    const jobRef = ref(database, path);
    let settled = false;
    let unsubscribe: () => void = () => undefined;
    let timeout = 0;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      unsubscribe();
      callback();
    };

    unsubscribe = onValue(
      jobRef,
      (snapshot: DataSnapshot) => {
        if (!snapshot.exists()) return;
        const job = snapshot.val() as GenerationJobRecord;
        onProgress?.(translateProgress(job, targetCards));

        if (job.status === "complete" && job.result?.cards && job.result?.meta) {
          finish(() => resolve(job.result as BackgroundResult));
          return;
        }

        if (job.status === "error") {
          finish(() => reject(new AIGenerationError(
            job.errorMessage || "Não foi possível concluir a geração.",
            "background_generation_error",
            true,
          )));
        }
      },
      () => finish(() => reject(new AIGenerationError(
        "A conexão com o acompanhamento da geração foi interrompida.",
        "job_listener_error",
        true,
      ))),
    );

    timeout = window.setTimeout(() => {
      finish(() => reject(new AIGenerationError(
        "A geração está demorando além do esperado. Ela pode continuar em segundo plano; aguarde um pouco antes de tentar novamente.",
        "background_wait_timeout",
        true,
      )));
    }, BACKGROUND_WAIT_MS);
  });
}

export async function generateFlashcardsFromDocument({
  user,
  deck,
  document,
  options,
  onProgress,
}: {
  user: User;
  deck: Deck;
  document: ExtractedDocument;
  options: GenerationOptions;
  onProgress?: (progress: GenerationProgress) => void;
}): Promise<{ cards: Flashcard[]; meta: GenerationMeta }> {
  if (document.characterCount > MAX_DOCUMENT_CHARACTERS) {
    throw new AIGenerationError(
      "Este documento tem mais de 120 mil caracteres. Nesta fase, use um material menor; documentos maiores serão suportados depois.",
      "document_too_large",
    );
  }
  if (options.cardTypes.length === 0) {
    throw new AIGenerationError("Selecione pelo menos um tipo de card.", "no_card_type");
  }
  if (!document.documentId) {
    throw new AIGenerationError("O documento ainda não possui um registro válido.", "missing_document_id");
  }

  const jobsRef = ref(database, `documents/${user.uid}/${document.documentId}/generationJobs`);
  const newJobRef = push(jobsRef);
  const jobId = newJobRef.key;
  if (!jobId) throw new AIGenerationError("Não foi possível criar o identificador da geração.", "job_id_error");

  const now = new Date().toISOString();
  await set(newJobRef, {
    id: jobId,
    status: "queued",
    stage: "starting",
    stageLabel: "Preparando a geração",
    targetCards: options.cardCount,
    generatedCards: 0,
    createdAt: now,
    updatedAt: now,
    resultStoredTemporarily: true,
    sourceTextStored: false,
  });

  const idToken = await user.getIdToken();
  const path = `documents/${user.uid}/${document.documentId}/generationJobs/${jobId}`;

  try {
    onProgress?.({
      completedBatches: 0,
      totalBatches: 1,
      generatedCards: 0,
      targetCards: options.cardCount,
      stage: "generating",
      label: "Preparando a geração",
    });

    await invokeBackgroundJob({ idToken, jobId, deck, document, options });
    const result = await waitForJob({ path, targetCards: options.cardCount, onProgress });

    const generatedAt = result.meta.generatedAt || new Date().toISOString();
    const cards = result.cards.map((card) => mapCard(deck, document, card, generatedAt));

    // O job contém apenas progresso e os cards derivados. Assim que a tela recebe
    // o resultado, removemos esse armazenamento temporário do Realtime Database.
    await remove(newJobRef).catch(() => undefined);

    if (!cards.length) {
      throw new AIGenerationError(
        "O material não produziu cards que passassem pelos filtros de qualidade.",
        "no_cards_generated",
      );
    }

    return { cards, meta: { ...result.meta, returnedCount: cards.length } };
  } catch (error) {
    // Em falha de inicialização, limpamos o job. Se o processamento já tiver sido
    // aceito pela Netlify, deixamos o registro para o background concluir/registrar erro.
    if (error instanceof AIGenerationError && error.code.startsWith("background_start_")) {
      await remove(newJobRef).catch(() => undefined);
    }
    throw error;
  }
}
