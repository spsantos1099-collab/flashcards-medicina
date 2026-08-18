import { callGemini, extractGeminiText } from "./generate-flashcards.mjs";

const MODEL = process.env.GEMINI_FLASHCARD_FAST_MODEL || "gemini-3.5-flash-lite";
const MAX_QUESTIONS = 8;
const TIMEOUT_MS = 45_000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function verifyFirebaseUser(idToken) {
  const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!firebaseApiKey) return false;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) return false;
  const data = await response.json();
  return Array.isArray(data.users) && data.users.length > 0;
}

function cleanText(value, max = 3_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_QUESTIONS).map((item) => ({
    code: cleanText(item?.code, 60),
    question: cleanText(item?.question, 2_500),
    correctAnswer: cleanText(item?.correctAnswer, 1_500),
    explanation: cleanText(item?.explanation, 2_500),
    difficulty: ["easy", "medium", "hard"].includes(item?.difficulty) ? item.difficulty : "medium",
  })).filter((item) => item.code && item.question && item.correctAnswer);
}

function buildPrompt(questions) {
  return `Você transforma questões de prova médica em flashcards CURTOS para memorização rápida.

REGRA MAIS IMPORTANTE
- A resposta marcada como GABARITO é soberana. NÃO corrija, NÃO substitua e NÃO contradiga o gabarito.
- Use SOMENTE o ENUNCIADO, o GABARITO e o COMENTÁRIO fornecidos para aquela questão.
- NÃO use conhecimento externo, internet ou memória médica.
- Sua tarefa é apenas REDUZIR e REESCREVER, preservando exatamente o significado clínico do gabarito.

OBJETIVO
Para CADA questão, gere exatamente UM flashcard básico, curto e ATÔMICO.
O card deve cobrar UMA única ideia principal de memória.

1) ASSUNTO DO CARD (topic)
- Gere um assunto clínico curto e útil para organização e filtros.
- Inferir APENAS do enunciado + gabarito + comentário. Não existe outro metadado confiável.
- Use de 2 a 6 palavras, preferindo doença, síndrome, conduta ou conceito clínico central.
- Nunca devolva listas extensas de assuntos, ementas de disciplina ou categorias que não correspondam ao conteúdo real da questão.
- Se dois conceitos forem realmente inseparáveis para identificar o card, use no máximo dois, unidos por "e".

2) ATOMICIDADE
- Primeiro identifique UMA ideia-alvo: diagnóstico OU conduta OU critério OU mecanismo OU prognóstico OU outra decisão clínica central.
- A pergunta deve testar somente essa ideia-alvo.
- Evite perguntas que cobrem dois fatos independentes, especialmente construções como "qual o mecanismo E a vantagem", "qual o diagnóstico E o tratamento" ou "quais são X E Y".
- Quando houver mecanismo → consequência, prefira uma pergunta causal única (por exemplo, "Por que X produz Y?") em vez de cobrar mecanismo e consequência como duas respostas separadas.
- Se o gabarito tiver uma conduta combinada inseparável, ela pode permanecer como uma única resposta à pergunta "qual a conduta?".
- Não crie mais de um card por questão nesta modalidade.

COMO ENCURTAR
- Remova nomes fictícios, local de atendimento e detalhes narrativos que não mudam a resposta.
- Em casos clínicos, mantenha somente os dados decisivos necessários para lembrar a conduta/diagnóstico.
- Não copie o comando genérico “assinale a alternativa correta”. Transforme-o em uma pergunta direta.
- Ignore todas as alternativas erradas e seus comentários.
- Não crie listas longas. Se o gabarito contém vários elementos inseparáveis, mantenha apenas os indispensáveis.
- Não altere números, doses, intervalos, critérios ou negações presentes no gabarito/comentário.
- Não acrescente ressalvas que não estejam na fonte.

EXEMPLO DE ATOMICIDADE (APENAS DE FORMA, NÃO DE CONTEÚDO)
Ruim: "Qual é o mecanismo e a vantagem de X?"
Melhor: "Por que X costuma produzir efeito mais duradouro?"
Resposta: "Porque [mecanismo causal presente na fonte]."

LIMITES DE TAMANHO
- topic: ideal 2–5 palavras; máximo 80 caracteres.
- question: ideal até 160 caracteres; máximo 220.
- answer: ideal até 110 caracteres; máximo 180.
- explanation: ideal 1–2 frases; máximo 320 caracteres.

FORMATO
Responda SOMENTE JSON válido, sem markdown:
{"cards":[{"code":"...","topic":"...","question":"...","answer":"...","explanation":"..."}]}
Retorne exatamente um objeto para cada código recebido, sem mudar o código.

QUESTÕES
${questions.map((item, index) => `
[${index + 1}] CÓDIGO: ${item.code}
ENUNCIADO: ${item.question}
GABARITO: ${item.correctAnswer}
COMENTÁRIO: ${item.explanation || "sem comentário"}`).join("\n")}`;
}

function extractJsonCandidate(text) {
  const candidate = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
}

function parseCards(text) {
  try {
    const parsed = JSON.parse(extractJsonCandidate(text));
    return Array.isArray(parsed?.cards) ? parsed.cards : null;
  } catch {
    return null;
  }
}

function normalizeOutput(cards, inputQuestions) {
  const expected = new Map(inputQuestions.map((question) => [question.code, question]));
  const seen = new Set();
  const result = [];

  for (const raw of Array.isArray(cards) ? cards : []) {
    const code = cleanText(raw?.code, 60);
    if (!code || !expected.has(code) || seen.has(code)) continue;
    const topic = cleanText(raw?.topic, 80);
    const question = cleanText(raw?.question, 220);
    const answer = cleanText(raw?.answer, 180);
    const explanation = cleanText(raw?.explanation, 320);
    if (!topic || !question || !answer) continue;
    seen.add(code);
    result.push({ code, topic, question, answer, explanation });
  }

  if (result.length !== inputQuestions.length) return null;
  return inputQuestions.map((question) => result.find((item) => item.code === question.code));
}

function providerErrorResponse(status, errorText) {
  const transient = status === 408 || status === 429 || status >= 500;
  const publicStatus = status === 429 ? 429 : status === 408 ? 504 : status >= 500 ? 502 : 400;
  const message = status === 429
    ? "A IA atingiu temporariamente o limite de requisições. Tente novamente em instantes ou use o formato fiel à prova."
    : transient
      ? "A IA ficou temporariamente indisponível ao simplificar os cards."
      : `O Gemini recusou a simplificação (erro ${status}).`;
  console.error("Modo Prova compacto: Gemini erro", status, String(errorText || "").slice(0, 1000));
  return json({ error: message, code: `ai_provider_${status}`, transient }, publicStatus);
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido.", code: "method_not_allowed" }, 405);

  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken || !(await verifyFirebaseUser(idToken))) return json({ error: "Sessão inválida.", code: "unauthorized" }, 401);

  const apiKey = process.env.FICHARIO_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return json({ error: "A chave da IA não foi configurada.", code: "missing_ai_key" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Corpo da requisição inválido.", code: "invalid_json" }, 400);
  }

  const questions = normalizeQuestions(body?.questions);
  if (!questions.length) return json({ error: "Nenhuma questão válida foi enviada.", code: "invalid_payload" }, 400);

  const prompt = buildPrompt(questions);
  let response;
  try {
    response = await callGemini({
      apiKey,
      model: MODEL,
      prompt,
      thinkingLevel: "minimal",
      timeoutMs: TIMEOUT_MS,
    });
  } catch (error) {
    if (error?.name === "AbortError") return json({ error: "A IA demorou demais para simplificar os cards.", code: "ai_timeout", transient: true }, 504);
    return json({ error: "Não foi possível alcançar a IA para simplificar os cards.", code: "ai_network_error", transient: true }, 502);
  }

  if (!response.ok) return providerErrorResponse(response.status, await response.text());

  let data;
  try {
    data = await response.json();
  } catch {
    return json({ error: "A IA retornou uma resposta inválida.", code: "invalid_ai_json", transient: true }, 502);
  }

  const cards = normalizeOutput(parseCards(extractGeminiText(data)), questions);
  if (!cards) {
    return json({
      error: "A IA não devolveu todos os cards simplificados no formato esperado. Tente novamente ou use o formato fiel à prova.",
      code: "incomplete_ai_response",
      transient: true,
    }, 502);
  }

  return json({ provider: "gemini", model: MODEL, cards });
};
