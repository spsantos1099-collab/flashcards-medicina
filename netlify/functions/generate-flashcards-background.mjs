import {
  buildClinicalValidatorPrompt,
  buildGenerationPrompt,
  callGemini,
  cardsAreSemanticDuplicates,
  extractGeminiText,
  parseModelCards,
  parseValidationResults,
  providerRetryAfterMs,
  sanitizeCards,
} from "./generate-flashcards.mjs";

const FAST_MODEL = process.env.GEMINI_FLASHCARD_FAST_MODEL || "gemini-3.5-flash-lite";
const CLINICAL_MODEL = process.env.GEMINI_FLASHCARD_CLINICAL_MODEL || "gemini-3.6-flash";
const VALIDATOR_MODEL = process.env.GEMINI_FLASHCARD_VALIDATOR_MODEL || "gemini-3.6-flash";
const CLINICAL_FALLBACK_MODEL = process.env.GEMINI_FLASHCARD_CLINICAL_FALLBACK_MODEL || "gemini-3.5-flash";
const VALIDATOR_FALLBACK_MODEL = process.env.GEMINI_FLASHCARD_VALIDATOR_FALLBACK_MODEL || "gemini-3.5-flash";
const MAX_DOCUMENT_CHARACTERS = 120_000;
const MAX_PROVIDER_ATTEMPTS = 5;
const MAX_REFILL_ROUNDS = 2;
const MAX_CANDIDATES_PER_CALL = 24;
const FAST_TIMEOUT_MS = 90_000;
const CLINICAL_TIMEOUT_MS = 150_000;
const VALIDATOR_TIMEOUT_MS = 150_000;
const ALLOWED_TYPES = new Set(["basic", "cloze", "clinical_case"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value, max = 10_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isoNow() {
  return new Date().toISOString();
}

function normalizePages(document) {
  return Array.isArray(document?.pages)
    ? document.pages
        .map((page) => ({
          pageNumber: Number.isInteger(page?.pageNumber) ? page.pageNumber : 0,
          text: cleanText(page?.text, MAX_DOCUMENT_CHARACTERS),
        }))
        .filter((page) => page.text)
    : [];
}

function allocateTypeTargets(types, totalCards) {
  const unique = Array.from(new Set(types.filter((type) => ALLOWED_TYPES.has(type))));
  const targets = new Map();
  if (!unique.length) return targets;
  const base = Math.floor(totalCards / unique.length);
  let remainder = totalCards % unique.length;
  for (const type of unique) {
    targets.set(type, base + (remainder-- > 0 ? 1 : 0));
  }
  return targets;
}

function normalizeJobPayload(body) {
  const deck = body?.deck || {};
  const document = body?.document || {};
  const options = body?.options || {};
  const pages = normalizePages(document);
  const totalCharacters = pages.reduce((sum, page) => sum + page.text.length, 0);
  const cardTypes = Array.isArray(options.cardTypes)
    ? Array.from(new Set(options.cardTypes.filter((type) => ALLOWED_TYPES.has(type))))
    : [];
  const cardCount = Math.max(3, Math.min(40, Number(options.cardCount) || 15));
  return {
    jobId: cleanText(body?.jobId, 120),
    deck: {
      id: cleanText(deck.id, 180),
      title: cleanText(deck.title, 120),
      specialty: cleanText(deck.specialty, 120),
      topic: cleanText(deck.topic, 160),
    },
    document: {
      id: cleanText(document.id, 180),
      name: cleanText(document.name, 240),
      extension: document.extension === "docx" ? "docx" : "pdf",
      pages,
      totalCharacters,
    },
    options: {
      amountMode: ["essential", "balanced", "detailed", "custom"].includes(options.amountMode)
        ? options.amountMode
        : "balanced",
      cardCount,
      cardTypes,
      priorities: Array.isArray(options.priorities)
        ? options.priorities.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 8)
        : [],
    },
  };
}

async function verifyFirebaseUser(idToken) {
  const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!firebaseApiKey) throw new Error("firebase_api_key_missing");
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) throw new Error("unauthorized");
  const data = await response.json();
  const uid = data?.users?.[0]?.localId;
  if (!uid) throw new Error("unauthorized");
  return uid;
}

function databaseBaseUrl() {
  const raw = process.env.VITE_FIREBASE_DATABASE_URL || "";
  return raw.replace(/\/$/, "");
}

function jobUrl(uid, documentId, jobId, idToken) {
  const base = databaseBaseUrl();
  if (!base) throw new Error("firebase_database_url_missing");
  return `${base}/documents/${encodeURIComponent(uid)}/${encodeURIComponent(documentId)}/generationJobs/${encodeURIComponent(jobId)}.json?auth=${encodeURIComponent(idToken)}`;
}

async function patchJob({ uid, documentId, jobId, idToken }, patch) {
  const response = await fetch(jobUrl(uid, documentId, jobId, idToken), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...patch, updatedAt: isoNow() }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("Generation job: Firebase PATCH falhou", response.status, text.slice(0, 600));
    throw new Error("job_update_failed");
  }
}

async function getJob({ uid, documentId, jobId, idToken }) {
  const response = await fetch(jobUrl(uid, documentId, jobId, idToken), { headers: { "cache-control": "no-store" } });
  if (!response.ok) return null;
  return response.json();
}

function sourceInput(payload, type, cardCount, accepted, generationPhase = "initial") {
  return {
    task: "generate",
    deck: payload.deck,
    document: payload.document,
    options: {
      ...payload.options,
      requestedType: type,
      cardTypes: [type],
      cardCount,
      generationPhase,
      excludedQuestions: accepted.map((card) => card.question).slice(-40),
      excludedObjectives: accepted.map((card) => card.learningObjective).filter(Boolean).slice(-40),
    },
    candidates: [],
  };
}

function validatorInput(payload, candidates) {
  return {
    task: "validate_clinical",
    deck: payload.deck,
    document: payload.document,
    options: {
      ...payload.options,
      requestedType: "clinical_case",
      cardTypes: ["clinical_case"],
      cardCount: candidates.length,
      generationPhase: "initial",
      excludedQuestions: [],
      excludedObjectives: [],
    },
    candidates,
  };
}

function isTransientProviderStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function callModelWithRetry({
  apiKey,
  model,
  fallbackModel,
  prompt,
  thinkingLevel,
  timeoutMs,
  onRetry,
  label,
}) {
  const models = fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];
  let lastError = null;

  for (const selectedModel of models) {
    for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
      let response;
      try {
        response = await callGemini({
          apiKey,
          model: selectedModel,
          prompt,
          thinkingLevel,
          timeoutMs,
        });
      } catch (error) {
        lastError = error;
        if (attempt >= MAX_PROVIDER_ATTEMPTS) break;
        await onRetry?.({ attempt: attempt + 1, model: selectedModel, reason: "network_or_timeout" });
        await sleep(Math.min(30_000, 1_500 * 2 ** (attempt - 1) + Math.round(Math.random() * 900)));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        const retryAfterMs = providerRetryAfterMs(response, errorText) || 0;
        lastError = new Error(`provider_${response.status}`);
        console.error(`${label}: Gemini erro`, selectedModel, response.status, errorText.slice(0, 1200));
        if (!isTransientProviderStatus(response.status) || attempt >= MAX_PROVIDER_ATTEMPTS) break;
        await onRetry?.({ attempt: attempt + 1, model: selectedModel, reason: `provider_${response.status}` });
        const exponential = 1_500 * 2 ** (attempt - 1) + Math.round(Math.random() * 900);
        await sleep(Math.min(45_000, Math.max(retryAfterMs, exponential)));
        continue;
      }

      let data;
      try {
        data = await response.json();
      } catch {
        lastError = new Error("invalid_provider_json");
        if (attempt >= MAX_PROVIDER_ATTEMPTS) break;
        await onRetry?.({ attempt: attempt + 1, model: selectedModel, reason: "invalid_provider_json" });
        await sleep(1_500 * attempt);
        continue;
      }

      const text = extractGeminiText(data);
      if (!text) {
        lastError = new Error("empty_provider_response");
        if (attempt >= MAX_PROVIDER_ATTEMPTS) break;
        await onRetry?.({ attempt: attempt + 1, model: selectedModel, reason: "empty_provider_response" });
        await sleep(1_500 * attempt);
        continue;
      }

      return { text, model: selectedModel };
    }
  }

  throw lastError || new Error("provider_failed");
}

function appendUnique(target, candidates, maximumToAdd) {
  let added = 0;
  for (const candidate of candidates) {
    if (target.some((existing) => cardsAreSemanticDuplicates(existing, candidate))) continue;
    target.push(candidate);
    added += 1;
    if (added >= maximumToAdd) break;
  }
  return added;
}

function countByType(cards, type) {
  return cards.filter((card) => card.type === type).length;
}

function candidateRequestCount(target, type, refill = false) {
  const cushion = type === "clinical_case"
    ? Math.max(refill ? 3 : 4, Math.ceil(target * (refill ? 0.5 : 0.45)))
    : Math.max(refill ? 2 : 3, Math.ceil(target * (refill ? 0.35 : 0.4)));
  return Math.min(MAX_CANDIDATES_PER_CALL, Math.max(1, target + cushion));
}

async function generateType({ payload, type, target, accepted, apiKey, jobContext, modelsUsed, refillRound = 0 }) {
  const missing = target - countByType(accepted, type);
  if (missing <= 0) return 0;
  const requestCount = candidateRequestCount(missing, type, refillRound > 0);
  const input = sourceInput(payload, type, requestCount, accepted, refillRound > 0 ? "refill" : "initial");
  const prompt = buildGenerationPrompt(input);
  const clinical = type === "clinical_case";

  await patchJob(jobContext, {
    status: "processing",
    stage: clinical ? "generating_clinical" : type === "cloze" ? "generating_cloze" : "generating_basic",
    stageLabel: clinical ? "Construindo casos clínicos" : type === "cloze" ? "Gerando cards Cloze" : "Gerando cards básicos",
    retryAttempt: null,
    refillRound: refillRound || null,
  });

  const generated = await callModelWithRetry({
    apiKey,
    model: clinical ? CLINICAL_MODEL : FAST_MODEL,
    fallbackModel: clinical ? CLINICAL_FALLBACK_MODEL : null,
    prompt,
    thinkingLevel: clinical ? "low" : "minimal",
    timeoutMs: clinical ? CLINICAL_TIMEOUT_MS : FAST_TIMEOUT_MS,
    label: `generation_${type}`,
    onRetry: async ({ attempt, model, reason }) => {
      await patchJob(jobContext, {
        status: "processing",
        stage: "retrying",
        stageLabel: "Aguardando a IA e tentando novamente",
        retryAttempt: attempt,
        activeModel: model,
        retryReason: reason,
      });
    },
  });
  modelsUsed.add(generated.model);

  const rawCards = parseModelCards(generated.text);
  if (!rawCards) throw new Error("invalid_generation_json");
  let candidates = sanitizeCards(rawCards, input);

  if (clinical && candidates.length > 0) {
    await patchJob(jobContext, {
      status: "processing",
      stage: "validating_clinical",
      stageLabel: "Revisando os casos clínicos",
      retryAttempt: null,
      activeModel: VALIDATOR_MODEL,
    });

    const vInput = validatorInput(payload, candidates);
    const vPrompt = buildClinicalValidatorPrompt(vInput, candidates);
    const validated = await callModelWithRetry({
      apiKey,
      model: VALIDATOR_MODEL,
      fallbackModel: VALIDATOR_FALLBACK_MODEL,
      prompt: vPrompt,
      thinkingLevel: "low",
      timeoutMs: VALIDATOR_TIMEOUT_MS,
      label: "clinical_validator",
      onRetry: async ({ attempt, model, reason }) => {
        await patchJob(jobContext, {
          status: "processing",
          stage: "retrying",
          stageLabel: "Revisando novamente os casos clínicos",
          retryAttempt: attempt,
          activeModel: model,
          retryReason: reason,
        });
      },
    });
    modelsUsed.add(validated.model);
    const results = parseValidationResults(validated.text, candidates.length);
    if (!results) throw new Error("invalid_validator_json");
    candidates = candidates.filter((_, index) => results[index]?.accepted);
  }

  const added = appendUnique(accepted, candidates, missing);
  return added;
}

async function runPipeline({ payload, apiKey, jobContext }) {
  const targets = allocateTypeTargets(payload.options.cardTypes, payload.options.cardCount);
  const accepted = [];
  const modelsUsed = new Set();

  const progressPatch = async (extra = {}) => {
    const typeProgress = {};
    for (const [type, target] of targets.entries()) {
      typeProgress[type] = { target, accepted: Math.min(target, countByType(accepted, type)) };
    }
    await patchJob(jobContext, {
      generatedCards: Array.from(targets.entries()).reduce(
        (sum, [type, target]) => sum + Math.min(target, countByType(accepted, type)),
        0,
      ),
      targetCards: payload.options.cardCount,
      typeProgress,
      ...extra,
    });
  };

  await progressPatch({ status: "processing", stage: "starting", stageLabel: "Preparando a geração" });

  for (const type of payload.options.cardTypes) {
    const target = targets.get(type) || 0;
    if (!target) continue;
    try {
      await generateType({ payload, type, target, accepted, apiKey, jobContext, modelsUsed });
    } catch (error) {
      console.error("Generation job: falha inicial do tipo", type, error);
    }
    await progressPatch();
  }

  for (let round = 1; round <= MAX_REFILL_ROUNDS; round += 1) {
    let missingTotal = 0;
    for (const [type, target] of targets.entries()) {
      missingTotal += Math.max(0, target - countByType(accepted, type));
    }
    if (missingTotal <= 0) break;

    await progressPatch({ status: "processing", stage: "refill", stageLabel: `Completando seleção · rodada ${round}`, refillRound: round });
    let addedRound = 0;

    for (const type of payload.options.cardTypes) {
      const target = targets.get(type) || 0;
      if (countByType(accepted, type) >= target) continue;
      try {
        addedRound += await generateType({ payload, type, target, accepted, apiKey, jobContext, modelsUsed, refillRound: round });
      } catch (error) {
        console.error("Generation job: falha de reposição", type, round, error);
      }
      await progressPatch();
    }

    if (addedRound === 0 && round >= 2) break;
  }

  const finalCards = [];
  for (const type of payload.options.cardTypes) {
    const target = targets.get(type) || 0;
    finalCards.push(...accepted.filter((card) => card.type === type).slice(0, target));
  }

  return {
    cards: finalCards.slice(0, payload.options.cardCount),
    meta: {
      provider: "gemini",
      model: modelsUsed.size ? Array.from(modelsUsed).join(" + ") : "gemini",
      requestedCount: payload.options.cardCount,
      returnedCount: Math.min(finalCards.length, payload.options.cardCount),
      generatedAt: isoNow(),
      documentName: payload.document.name,
    },
  };
}

export default async (request) => {
  if (request.method !== "POST") return;
  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) return;

  let body;
  try {
    body = await request.json();
  } catch {
    return;
  }

  const payload = normalizeJobPayload(body);
  if (!payload.jobId || !payload.document.id || !payload.deck.title || !payload.document.pages.length || !payload.options.cardTypes.length) {
    return;
  }
  if (payload.document.totalCharacters > MAX_DOCUMENT_CHARACTERS) return;

  let uid;
  try {
    uid = await verifyFirebaseUser(idToken);
  } catch {
    return;
  }

  const jobContext = { uid, documentId: payload.document.id, jobId: payload.jobId, idToken };

  try {
    const existing = await getJob(jobContext);
    if (existing?.status === "complete") return;

    await patchJob(jobContext, {
      status: "processing",
      stage: "starting",
      stageLabel: "Preparando a geração",
      targetCards: payload.options.cardCount,
      generatedCards: 0,
      startedAt: existing?.startedAt || isoNow(),
      completedAt: null,
      errorCode: null,
      errorMessage: null,
    });

    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!apiKey) throw new Error("missing_ai_key");

    const result = await runPipeline({ payload, apiKey, jobContext });
    if (!result.cards.length) throw new Error("no_cards_generated");

    await patchJob(jobContext, {
      status: "complete",
      stage: "complete",
      stageLabel: result.cards.length >= payload.options.cardCount
        ? "Geração concluída"
        : `Geração concluída com ${result.cards.length} cards de alta qualidade`,
      generatedCards: result.cards.length,
      targetCards: payload.options.cardCount,
      completedAt: isoNow(),
      result,
      retryAttempt: null,
      retryReason: null,
    });
  } catch (error) {
    console.error("Generation background job failed", error);
    try {
      await patchJob(jobContext, {
        status: "error",
        stage: "error",
        stageLabel: "Não foi possível concluir a geração",
        completedAt: isoNow(),
        errorCode: error?.message || "generation_failed",
        errorMessage: "A geração não pôde ser concluída automaticamente. Aguarde alguns instantes e tente novamente.",
        retryAttempt: null,
      });
    } catch (updateError) {
      console.error("Generation background job: não conseguiu registrar erro", updateError);
    }
  }
};

export const config = {
  background: true,
};
