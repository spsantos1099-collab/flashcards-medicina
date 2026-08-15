const FAST_MODEL = process.env.GEMINI_FLASHCARD_FAST_MODEL || "gemini-3.5-flash-lite";
const CLINICAL_MODEL = process.env.GEMINI_FLASHCARD_CLINICAL_MODEL || "gemini-3.5-flash";
const VALIDATOR_MODEL = process.env.GEMINI_FLASHCARD_VALIDATOR_MODEL || "gemini-3.5-flash";
const MAX_REQUEST_CHARACTERS = 24_000;
const FAST_TIMEOUT_MS = 20_000;
const CLINICAL_TIMEOUT_MS = 23_000;
const VALIDATOR_TIMEOUT_MS = 21_000;
const ALLOWED_TYPES = new Set(["basic", "cloze", "clinical_case"]);
const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

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

function cleanText(value, max = 10_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizePages(document) {
  return Array.isArray(document?.pages)
    ? document.pages
        .map((page) => ({
          pageNumber: Number.isInteger(page?.pageNumber) ? page.pageNumber : 0,
          text: cleanText(page?.text, MAX_REQUEST_CHARACTERS),
        }))
        .filter((page) => page.text)
    : [];
}

function normalizeInput(body) {
  const deck = body?.deck || {};
  const document = body?.document || {};
  const options = body?.options || {};
  const pages = normalizePages(document);
  const totalCharacters = pages.reduce((sum, page) => sum + page.text.length, 0);
  const cardTypes = Array.isArray(options.cardTypes)
    ? options.cardTypes.filter((type) => ALLOWED_TYPES.has(type))
    : [];
  const requestedType = ALLOWED_TYPES.has(options.requestedType)
    ? options.requestedType
    : cardTypes[0] || "basic";
  const maxCards = requestedType === "clinical_case" ? 3 : 6;

  return {
    task: body?.task === "validate_clinical" ? "validate_clinical" : "generate",
    deck: {
      title: cleanText(deck.title, 120),
      specialty: cleanText(deck.specialty, 120),
      topic: cleanText(deck.topic, 160),
    },
    document: {
      id: cleanText(document.id, 160),
      name: cleanText(document.name, 240),
      extension: document.extension === "docx" ? "docx" : "pdf",
      pages,
      totalCharacters,
    },
    options: {
      cardCount: Math.max(1, Math.min(maxCards, Number(options.cardCount) || 3)),
      requestedType,
      priorities: Array.isArray(options.priorities)
        ? options.priorities.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 8)
        : [],
      excludedQuestions: Array.isArray(options.excludedQuestions)
        ? options.excludedQuestions.map((item) => cleanText(item, 320)).filter(Boolean).slice(-40)
        : [],
      excludedObjectives: Array.isArray(options.excludedObjectives)
        ? options.excludedObjectives.map((item) => cleanText(item, 220)).filter(Boolean).slice(-40)
        : [],
      amountMode: ["essential", "balanced", "detailed", "custom"].includes(options.amountMode)
        ? options.amountMode
        : "balanced",
      generationPhase: options.generationPhase === "refill" ? "refill" : "initial",
    },
    candidates: Array.isArray(body?.candidates) ? body.candidates.slice(0, 6) : [],
  };
}

function sourceBlock(input) {
  return input.document.pages
    .map((page) => {
      const marker = input.document.extension === "pdf" ? `[PÁGINA ${page.pageNumber}]` : "[DOCUMENTO DOCX]";
      return `${marker}\n${page.text}`;
    })
    .join("\n\n");
}

export function buildGenerationPrompt(input) {
  const source = sourceBlock(input);
  const type = input.options.requestedType;
  const priorities = input.options.priorities.length
    ? input.options.priorities.join(", ")
    : "nenhuma prioridade manual; selecione pelo valor educacional e clínico";

  const amountGuidance = {
    essential: "Seja altamente seletivo: priorize somente conhecimentos que mudam diagnóstico, conduta, segurança ou aparecem com frequência em prova.",
    balanced: "Faça cobertura equilibrada dos pontos de maior valor: diagnóstico, conduta, critérios, números, contraindicações e exceções, sem gastar cards com detalhes periféricos.",
    detailed: "Faça cobertura ampla do trecho, incluindo pontos de segunda linha úteis para prova, sem sacrificar atomicidade nem criar trivia irrelevante.",
    custom: "Tente atingir a quantidade solicitada usando apenas cards úteis e não redundantes; não crie conteúdo fraco só para preencher número.",
  }[input.options.amountMode];

  const excludedQuestions = input.options.excludedQuestions.length
    ? `\nPERGUNTAS JÁ ACEITAS — NÃO REPITA NEM REFORMULE:\n${input.options.excludedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";
  const excludedObjectives = input.options.excludedObjectives.length
    ? `\nOBJETIVOS DE APRENDIZAGEM JÁ COBERTOS — NÃO COBRE DE NOVO:\n${input.options.excludedObjectives.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";

  const typeRules = type === "clinical_case"
    ? `TIPO OBRIGATÓRIO: clinical_case. Gere SOMENTE casos clínicos curtos, realistas e orientados a uma decisão.
- Cada caso deve testar UM objetivo principal: diagnóstico, classificação, indicação, contraindicação, conduta, encaminhamento, limiar aplicado, segurança ou interpretação de um critério.
- O caso precisa exigir aplicação/raciocínio. Se a pergunta poderia ser feita praticamente igual sem o paciente (por exemplo, apenas "qual é a dose de X?"), isso NÃO é um bom caso clínico: transforme o objetivo em uma decisão clínica ou escolha outro objetivo.
- Você PODE criar BACKGROUND NARRATIVO plausível que não determine a resposta: idade/sexo, local de atendimento, profissão, retorno ambulatorial, acompanhante, rotina e detalhes neutros que deem naturalidade ao caso. Esses detalhes não precisam constar literalmente no documento.
- Você também pode criar detalhes clínicos de ambientação, desde que NÃO introduzam uma regra médica nova nem sejam necessários para justificar a resposta. Ex.: "idoso, de baixo peso, pesando 45 kg" é aceitável se o documento já traz "baixo peso"; NÃO conclua que 45 kg, sozinho, é o corte de baixo peso se o documento não definiu esse limiar.
- DADOS DECISIVOS precisam ser sustentados pelo documento: critérios, sinais/sintomas que mudam classificação, exames decisivos, valores-limite, doses, contraindicações, indicações, conectores E/OU e a relação que leva à conduta.
- Você pode criar valores sintéticos (idade, FE, BNP, TFG, potássio etc.) quando eles testarem diretamente um limiar explícito. Ex.: se o documento diz idade < 75, 62 ou 78 podem ser usados para testar inclusão/exclusão.
- Não invente limiares, critérios, contraindicações, indicações, relações causais ou conhecimentos médicos necessários para chegar à resposta.
- Um caso pode conter informação neutra/irrelevante para parecer prova real, mas nunca um detalhe enganoso que exija conhecimento externo ao documento para ser descartado.
- Se uma regra usa OU, basta uma condição verdadeira; não conclua “não” porque as outras condições estão ausentes. Se uma regra usa E/combinação obrigatória, inclua TODOS os critérios necessários antes de concluir elegibilidade.
- Antes de responder, confira se a conclusão decorre logicamente dos dados decisivos do caso e das regras do documento.
- A dificuldade precisa combinar com o raciocínio exigido. Se o objetivo for CALCULAR uma pontuação ou RECONHECER uma classe/estágio, NÃO entregue no enunciado os pontos parciais, a soma, a classe ou o rótulo que o aluno deveria derivar. Ex.: em um caso de Boston, forneça FC/achados/radiografia, mas não escreva “(2 pontos)”.
- Se o objetivo for uma decisão POSTERIOR à classificação (ex.: conduta em um paciente já NYHA III), a classe pode ser fornecida porque ela é dado de entrada, não a resposta escondida.
- Um caso hard deve exigir ao menos dois passos reais de raciocínio ou uma exceção/combinação explícita; não rotule como hard uma simples comparação com um único limiar.
- evidences deve conter TODOS os trechos necessários para sustentar os dados decisivos e a regra usada na resposta (1 a 5 evidências). Background puramente narrativo não precisa de evidência.`
    : type === "cloze"
      ? `TIPO OBRIGATÓRIO: cloze. Gere SOMENTE cards Cloze.
- Regra padrão: use UMA lacuna de alto valor com {{c1::...}}. Use DUAS apenas quando forem um par inseparável do mesmo objetivo (ex.: dose inicial + dose alvo; dois limiares pareados).
- Cloze é especialmente adequado para limiares, doses, classificações, critérios, nomes de conduta e relações canônicas.
- Não esconda palavras genéricas/banais (ex.: "aeróbico", "paciente", "tratamento") só para criar uma lacuna. A parte oculta deve ser exatamente o conhecimento que vale recuperar em prova.
- Se uma frase contém uma escala com três ou mais categorias (ex.: improvável/possível/definitivo), NÃO esconda apenas duas e deixe a terceira visível. Prefira um card focado em uma única faixa ou reformule para um único objetivo atômico.
- Não faça uma frase longa com muitos dados expostos e apenas um blank pouco informativo. O enunciado deve direcionar claramente para a informação oculta.
- Não use Cloze para repetir um objetivo que já seria coberto por um card Básico/Caso clínico no mesmo deck.
- evidences deve conter exatamente 1 evidência que sustente diretamente o card.`
      : `TIPO OBRIGATÓRIO: basic. Gere SOMENTE cards Básicos.
- Faça pergunta direta com resposta curta e objetiva.
- Regra padrão: uma resposta deve caber em 1 a 3 itens independentes. Se exigir uma lista longa, divida o objetivo em cards menores.
- Prefira decisão, critério, indicação, contraindicação, limiar, dose ou classificação em vez de definições vagas.
- evidences deve conter exatamente 1 evidência que sustente diretamente o card.`;

  const refill = input.options.generationPhase === "refill"
    ? "Esta é uma rodada de REPOSIÇÃO. Busque lacunas de cobertura e gere apenas objetivos novos. Não faça variações cosméticas de cards anteriores."
    : "Esta é a geração principal. Distribua os cards pelos pontos importantes do trecho e evite concentração excessiva em um único subtópico.";

  return `Você é um elaborador profissional de flashcards médicos para internato, residência e provas de Medicina.
Seu trabalho é transformar SOMENTE o material fornecido em recuperação ativa de alto valor clínico.

REGRAS DE FONTE — INEGOCIÁVEIS
- Use SOMENTE o conteúdo entre <documento> e </documento>.
- NÃO complete com memória médica, internet ou outra diretriz.
- Se a informação não estiver sustentada no trecho recebido, não crie o card.
- Para PDF, cada evidência deve apontar para a página indicada por [PÁGINA X]. Para DOCX, use sourcePage = 0.
- Copie trechos curtos do documento. Pequenas quebras de linha/hifenização do PDF podem ser normalizadas, mas não parafraseie a evidência.

QUALIDADE — PADRÃO RESIDÊNCIA
- Priorize conhecimentos que mudam decisão: diagnóstico, próxima conduta, indicação, contraindicação, limiar, dose, classificação, gravidade, encaminhamento, monitorização, exceção e segurança.
- 1 card = 1 objetivo principal de recuperação.
- Evite trivia, epidemiologia pouco acionável e detalhes periféricos quando houver conteúdo clínico mais valioso.
- Evite duplicatas semânticas ENTRE TODOS OS TIPOS: mudar de Básico para Cloze ou para Caso clínico não transforma o mesmo objetivo de aprendizagem em um card novo.
- learningObjective deve ser uma frase curta, canônica e independente do tipo do card. Use o padrão “tema específico — fato/decisão”. Se dois cards cobrariam o mesmo conhecimento, eles DEVEM receber o mesmo learningObjective e apenas um deve ser gerado. Ex.: “Framingham — regra diagnóstica” ou “Critérios de Boston — diagnóstico definitivo”.
- Não concentre um deck curto em várias perguntas sobre a mesma regra quando existirem outros pontos importantes no documento.
- Um card difícil deve ser difícil pela decisão/precisão, não por ser longo ou confuso.
- CALIBRAÇÃO: easy = recuperação direta de um fato explícito; medium = aplicação de uma regra ou combinação curta de informações; hard = dois ou mais passos reais de raciocínio, cálculo/classificação, exceção relevante ou múltiplos critérios explícitos. Um número isolado não torna o card difícil.
- Revise ortografia e terminologia em português do Brasil antes de responder. Não deixe palavras em inglês escaparem para pergunta/resposta/explicação, salvo siglas ou nomes próprios inevitáveis.
- Não intensifique a fonte: nunca escreva “contraindicação absoluta”, “obrigatório”, “sempre”, “nunca” ou equivalentes se o documento não usar/sustentar esse grau de certeza.
- Preserve números, unidades, critérios, doses, classificações e conectores lógicos (E/OU) exatamente.
- Preserve a distinção entre recomendações diferentes. Não funda duas condutas em um rótulo mais amplo: por exemplo, se a fonte separa restrição de líquidos e orientação de ingestão de sal, mantenha-as separadas na pergunta e na resposta.
- Padronize apenas a apresentação, sem mudar o conteúdo: ICFEr/ICFEp, NT-proBNP, sacubitril/valsartana, NYHA, IECA, ARA II, TFG, FEVE e unidades como m² quando aplicável.

${typeRules}

SELEÇÃO
- ${amountGuidance}
- ${refill}
- Prioridades escolhidas: ${priorities}.
- Gere até ${input.options.cardCount} cards de alta qualidade. Tente atingir o número se houver conteúdo útil; gere menos se a alternativa for repetir ou inventar.${excludedQuestions}${excludedObjectives}

FORMATO
Responda SOMENTE JSON válido, sem markdown e sem comentários.
Raiz: {"cards":[...]}
Cada card deve conter exatamente:
- type: "${type}"
- learningObjective: string curta e canônica
- question: string
- answer: string
- explanation: string curta, baseada no documento
- topic: string
- tags: array com até 6 strings
- difficulty: "easy", "medium" ou "hard"
- evidences: array de objetos {"sourcePage": inteiro, "sourceExcerpt": string literal curta}

CONTEXTO
Especialidade: ${input.deck.specialty || "não informada"}
Deck: ${input.deck.title || "não informado"}
Tema: ${input.deck.topic || "não informado"}
Documento: ${input.document.name}

<documento>
${source}
</documento>`;
}

export function buildClinicalValidatorPrompt(input, candidates) {
  const source = sourceBlock(input);
  const compactCandidates = candidates.map((card, index) => ({
    index,
    learningObjective: card.learningObjective,
    question: card.question,
    answer: card.answer,
    explanation: card.explanation,
    evidences: card.evidences,
  }));

  return `Você é o SEGUNDO REVISOR de qualidade de casos clínicos médicos. Você NÃO cria nem corrige cards: apenas ACEITA ou REJEITA cada caso.
Use SOMENTE o documento fornecido. Seja conservador: se houver dúvida lógica, rejeite.

Para cada caso, separe mentalmente o enunciado em BACKGROUND e DADOS DECISIVOS.
- BACKGROUND narrativo (idade/sexo, profissão, local de atendimento, acompanhante, rotina, detalhes neutros) pode ser criado para dar realismo e não precisa estar literalmente no documento, desde que NÃO mude a resposta.
- DADO DECISIVO é qualquer informação clínica usada para chegar à resposta: critério, sintoma que muda classificação, exame/valor-limite, indicação, contraindicação, dose, relação causal ou conector E/OU. Esses dados e a regra decisória precisam ser sustentados pelo documento.

Verifique TODOS os itens:
1. A resposta decorre logicamente dos dados decisivos do caso e das regras do documento.
2. Nenhum dado decisivo exige conhecimento externo. Background puramente narrativo não é motivo de rejeição.
3. Todos os critérios obrigatórios para a conclusão estão presentes. Não aceite elegibilidade baseada em critério faltante.
4. Conectores lógicos estão corretos: em listas com OU, uma condição suficiente não pode ser ignorada; em regras combinadas com E, todos os critérios exigidos devem estar satisfeitos.
5. Não há contradição entre enunciado, resposta e evidências.
6. O caso testa um único objetivo principal e realmente exige aplicação/decisão. REJEITE se for apenas uma pergunta factual disfarçada de caso (ex.: inserir um paciente e perguntar uma dose que independe completamente dos dados do paciente).
7. Valores sintéticos usados para testar limiares explícitos são coerentes. Se o documento diz apenas "baixo peso" sem definir corte, um peso em kg pode aparecer como detalhe narrativo SOMENTE se o próprio enunciado também qualificar o paciente como "de baixo peso"; não aceite inferência de um corte inexistente.
8. A explicação não acrescenta conhecimento médico externo nem transforma background narrativo em regra médica.
9. A lista evidences cobre os trechos necessários para auditar TODOS os dados decisivos e a regra que leva à resposta; background neutro não exige evidência.
10. Informações neutras podem enriquecer o cenário, mas REJEITE detalhes enganosos que só possam ser descartados com conhecimento de fora do documento.
11. A dificuldade é coerente com o raciocínio? Se o caso foi marcado hard, ele precisa exigir cálculo/classificação, combinação de critérios, exceção ou pelo menos dois passos. REJEITE um caso hard que apenas compare um valor a um único limiar.
12. Se o objetivo do caso é calcular/reconhecer uma pontuação, classe ou estágio, o enunciado NÃO pode fornecer os pontos parciais, a soma ou a própria classe que deveria ser derivada. Se o objetivo é uma decisão posterior, a classe pode ser fornecida como dado de entrada.
13. Pergunta, resposta e explicação devem estar em português do Brasil e não podem intensificar a fonte com qualificadores como “contraindicação absoluta” se isso não estiver sustentado nas evidências.
14. A nomenclatura deve ser consistente (ex.: ICFEr, ICFEp, NT-proBNP, sacubitril/valsartana, m²), sem alterar os fatos da fonte.

Exemplo de erro a REJEITAR: o documento diz “congestão persistente OU NYHA III-IV OU hiponatremia”, o caso é NYHA III e a resposta diz que não há indicação porque não há congestão/hiponatremia. Isso viola o OU.

Responda SOMENTE JSON válido:
{"results":[{"index":0,"accepted":true,"reason":"curta"}]}
Inclua exatamente um resultado para cada índice recebido. Não reescreva os cards.

<CANDIDATOS>
${JSON.stringify(compactCandidates)}
</CANDIDATOS>

<DOCUMENTO>
${source}
</DOCUMENTO>`;
}

export function normalizeForSourceCheck(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[²₂]/g, "2")
    .replace(/[³₃]/g, "3")
    .replace(/[\u00ad\u200b\uFFFD\uFFFE\uFFFF]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/(\p{L})\s*-\s+(\p{L})/gu, "$1$2")
    .replace(/-\s+/g, "")
    .replace(/[^\p{L}\p{N}%<>=+/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function numericTokens(value) {
  return normalizeForSourceCheck(value).match(/\d+(?:\s+\d+)*/g) || [];
}

function orderedTokenCoverage(excerptTokens, pageTokens) {
  if (!excerptTokens.length || !pageTokens.length) return 0;
  let pageIndex = 0;
  let matched = 0;
  for (const token of excerptTokens) {
    while (pageIndex < pageTokens.length && pageTokens[pageIndex] !== token) pageIndex += 1;
    if (pageIndex >= pageTokens.length) break;
    matched += 1;
    pageIndex += 1;
  }
  return matched / excerptTokens.length;
}

function sourceMatchScore(sourceExcerpt, pageText) {
  const excerpt = normalizeForSourceCheck(sourceExcerpt);
  const page = normalizeForSourceCheck(pageText);
  if (!excerpt || !page) return 0;
  if (page.includes(excerpt)) return 1;

  const excerptTokens = excerpt.split(" ").filter(Boolean);
  const pageTokens = page.split(" ").filter(Boolean);
  if (excerptTokens.length < 5) return 0;
  const pageTokenSet = new Set(pageTokens);
  const matched = excerptTokens.filter((token) => pageTokenSet.has(token)).length;
  const bagCoverage = matched / excerptTokens.length;
  const orderedCoverage = orderedTokenCoverage(excerptTokens, pageTokens);

  const numbers = numericTokens(excerpt);
  const pageNumbers = new Set(numericTokens(page));
  const numbersPreserved = numbers.every((token) => pageNumbers.has(token));
  if (!numbersPreserved) return Math.min(Math.max(bagCoverage, orderedCoverage), 0.69);

  // Excertos de PDF podem chegar com hifens/espaços/Unicode diferentes.
  // A ordem das palavras vale mais que mera coincidência de vocabulário.
  return Math.max(orderedCoverage, bagCoverage * 0.92);
}

function findSourcePage(sourceExcerpt, input, preferredPage = 0) {
  if (input.document.extension !== "pdf") return 0;
  if (!cleanText(sourceExcerpt, 900)) return 0;

  const candidates = preferredPage
    ? [
        ...input.document.pages.filter((page) => page.pageNumber === preferredPage),
        ...input.document.pages.filter((page) => page.pageNumber !== preferredPage),
      ]
    : input.document.pages;

  let bestPage = 0;
  let bestScore = 0;
  for (const page of candidates) {
    const score = sourceMatchScore(sourceExcerpt, page.text);
    if (score > bestScore) {
      bestScore = score;
      bestPage = page.pageNumber;
    }
    if (score >= 0.999) return page.pageNumber;
  }

  return bestScore >= 0.82 ? bestPage : 0;
}


function polishMedicalText(value) {
  return cleanText(value, 1600)
    .replace(/\bgout\b/gi, "gota")
    .replace(/\besfreco\b/gi, "escore")
    .replace(/\bICFER\b/gi, "ICFEr")
    .replace(/\bICFEP\b/gi, "ICFEp")
    .replace(/\bNT\s*[-–— ]?\s*ProBNP\b/gi, "NT-proBNP")
    .replace(/\bsacubitril\s*[-–— ]\s*valsartana\b/gi, "sacubitril/valsartana")
    .replace(/\bARA\s*[-–— ]?\s*II\b/gi, "ARA II")
    .replace(/\bIECA\b/gi, "IECA")
    .replace(/\bNYHA\b/gi, "NYHA")
    .replace(/\bFEVE\b/gi, "FEVE")
    .replace(/\bTFG\b/gi, "TFG")
    .replace(/\bBNP\b/gi, "BNP")
    .replace(/m2\b/gi, "m²")
    .replace(/\s+%/g, "%")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function hasObviousLanguageLeak(card) {
  const text = `${card.question} ${card.answer} ${card.explanation}`.toLocaleLowerCase("pt-BR");
  return /\b(patient|treatment|contraindicated|guidelines?|heart failure|gout)\b/.test(text);
}

function evidenceText(card) {
  return (card.evidences || []).map((item) => item.sourceExcerpt || "").join(" ");
}

function passesSourceQualifierGuard(card) {
  const cardText = normalizeForSourceCheck(`${card.question} ${card.answer} ${card.explanation}`);
  const sourceText = normalizeForSourceCheck(evidenceText(card));
  // “absoluta” muda a força da recomendação. Só pode aparecer se a própria fonte sustentar esse qualificador.
  if (/\babsolut\w*/.test(cardText) && !/\babsolut\w*/.test(sourceText)) return false;
  return true;
}

function normalizeCardType(value) {
  const raw = String(value || "").trim().toLocaleLowerCase("pt-BR");
  if (["cloze", "lacuna"].includes(raw)) return "cloze";
  if (["clinical_case", "clinical case", "case", "caso clinico", "caso clínico"].includes(raw)) return "clinical_case";
  return "basic";
}

function normalizeDifficulty(value) {
  const raw = String(value || "").trim().toLocaleLowerCase("pt-BR");
  if (["easy", "facil", "fácil"].includes(raw)) return "easy";
  if (["hard", "dificil", "difícil"].includes(raw)) return "hard";
  return "medium";
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((tag) => cleanText(tag, 60)).filter(Boolean).slice(0, 6);
  if (typeof value === "string") return value.split(/[,;|]/).map((tag) => cleanText(tag, 60)).filter(Boolean).slice(0, 6);
  return [];
}

function normalizeEvidences(card, input) {
  const raw = Array.isArray(card?.evidences)
    ? card.evidences
    : [{ sourcePage: card?.sourcePage ?? card?.source_page ?? card?.page, sourceExcerpt: card?.sourceExcerpt ?? card?.source_excerpt ?? card?.excerpt }];

  const seen = new Set();
  const evidences = [];
  for (const evidence of raw.slice(0, 5)) {
    const sourceExcerpt = cleanText(evidence?.sourceExcerpt ?? evidence?.source_excerpt ?? evidence?.excerpt, 850);
    if (!sourceExcerpt) continue;
    const preferredPage = Number(evidence?.sourcePage ?? evidence?.source_page ?? evidence?.page) || 0;
    const sourcePage = findSourcePage(sourceExcerpt, input, preferredPage);
    if (input.document.extension === "pdf" && sourcePage <= 0) continue;
    const key = `${sourcePage}:${normalizeForSourceCheck(sourceExcerpt)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    evidences.push({ sourcePage, sourceExcerpt });
  }
  return evidences;
}

function estimateIndependentItems(answer) {
  const text = String(answer || "").trim();
  if (!text) return 0;
  const semicolonItems = text.split(/;/).map((item) => item.trim()).filter(Boolean);
  if (semicolonItems.length >= 4) return semicolonItems.length;
  const enumerated = text.match(/(?:^|\s)[(]?[a-h1-9][).:-]\s/gi) || [];
  if (enumerated.length >= 4) return enumerated.length;
  const commaItems = text.split(/,/).map((item) => item.trim()).filter(Boolean);
  if (commaItems.length >= 5 && commaItems.every((item) => item.length <= 110)) return commaItems.length;
  return Math.max(1, semicolonItems.length);
}

function passesAtomicityGuard(card) {
  const questionLimit = card.type === "clinical_case" ? 850 : 500;
  if (card.question.length > questionLimit || card.answer.length > 850) return false;
  if (card.type === "basic" && estimateIndependentItems(card.answer) > 3) return false;
  return true;
}

function cleanClozeAnswer(answer, question) {
  const answerText = cleanText(answer, 1400);
  const matches = [...String(question || "").matchAll(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g)]
    .map((match) => cleanText(match[1], 300))
    .filter(Boolean);
  if (/\{\{c\d+::/.test(answerText) || normalizeForSourceCheck(answerText) === normalizeForSourceCheck(question)) {
    return matches.length ? matches.join("; ") : answerText.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, "$1");
  }
  return answerText;
}

const OBJECTIVE_STOPWORDS = new Set([
  "criterio", "criterios", "regra", "regras", "paciente", "pacientes", "insuficiencia", "cardiaca",
  "cardiaco", "cardiologia", "tratamento", "diagnostico", "diagnostica", "diagnosticos", "uso", "para",
  "pela", "pelo", "com", "sem", "qual", "quais", "segundo", "conforme", "indicacao", "indicacoes",
  "conduta", "classificacao", "valor", "valores", "ponto", "pontos", "recomendado", "recomendada",
]);

function conceptTokens(value) {
  return new Set(
    normalizeForSourceCheck(value)
      .split(" ")
      .filter((token) => token.length >= 3 || /^\d/.test(token)),
  );
}

function objectiveTokens(value) {
  return new Set(
    normalizeForSourceCheck(value)
      .split(" ")
      .map((token) => {
        if (/^diagnost/.test(token)) return "diagnost";
        if (/^contraindic/.test(token)) return "contraindic";
        if (/^indic/.test(token)) return "indic";
        if (/^class/.test(token)) return "class";
        if (/^encaminh|^referenc/.test(token)) return "encaminh";
        if (/^substitu/.test(token)) return "substitu";
        return token;
      })
      .filter((token) => token.length >= 3 && !OBJECTIVE_STOPWORDS.has(token)),
  );
}

function similarityFromSets(A, B) {
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection += 1;
  return intersection / new Set([...A, ...B]).size;
}

function setSimilarity(a, b) {
  return similarityFromSets(conceptTokens(a), conceptTokens(b));
}

function objectiveSimilarity(a, b) {
  return similarityFromSets(objectiveTokens(a), objectiveTokens(b));
}

function bestEvidenceSimilarity(a, b) {
  let best = 0;
  for (const ea of a.evidences || []) {
    for (const eb of b.evidences || []) {
      if (ea.sourcePage !== eb.sourcePage) continue;
      best = Math.max(best, setSimilarity(ea.sourceExcerpt, eb.sourceExcerpt));
    }
  }
  return best;
}

export function cardsAreSemanticDuplicates(a, b) {
  const objectiveSim = objectiveSimilarity(a.learningObjective, b.learningObjective);
  if (objectiveSim >= 0.58) return true;

  const questionSimilarity = setSimilarity(a.question, b.question);
  const answerSimilarity = setSimilarity(a.answer, b.answer);
  const evidenceSimilarity = bestEvidenceSimilarity(a, b);

  if (questionSimilarity >= 0.90 && (answerSimilarity >= 0.45 || objectiveSim >= 0.50)) return true;

  // Mesmo fato escrito em formatos diferentes (ex.: Básico vs Cloze) costuma compartilhar
  // resposta e evidência, ainda que o learningObjective venha redigido de outra forma.
  if (evidenceSimilarity >= 0.82 && answerSimilarity >= 0.58) return true;
  if (evidenceSimilarity >= 0.92 && objectiveSim >= 0.50) return true;

  const sameAnswer = normalizeForSourceCheck(a.answer) === normalizeForSourceCheck(b.answer);
  return Boolean(sameAnswer && evidenceSimilarity >= 0.70);
}

function clozeValues(question) {
  return [...String(question || "").matchAll(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g)]
    .map((match) => cleanText(match[1], 300))
    .filter(Boolean);
}

function passesClozeQualityGuard(card) {
  const values = clozeValues(card.question);
  if (values.length < 1 || values.length > 2) return false;

  // Evita blanks quase sem conteúdo, mantendo classificações curtas como IV/II.
  if (values.some((value) => value.length === 1 && !/^[IVX]+$/i.test(value) && !/^\d$/.test(value))) return false;

  const lowValueSingles = new Set(["aerobico", "paciente", "tratamento", "medicamento", "doenca"]);
  if (values.some((value) => lowValueSingles.has(normalizeForSourceCheck(value)))) return false;

  // Duas lacunas devem representar um par coerente; respostas muito distintas e longas
  // tendem a indicar que o card juntou objetivos independentes.
  if (values.length === 2 && values.some((value) => value.length > 80)) return false;

  // Evita escalas de 3+ categorias em que apenas parte das respostas é escondida e o resto
  // fica visível, entregando o padrão (caso clássico: improvável/possível/definitivo).
  const plain = String(card.question || "").replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, "_____ ");
  const relationCount = (plain.match(/\b(indica|corresponde|define|classifica)\b/gi) || []).length;
  if (relationCount >= 3) return false;

  return true;
}

export function sanitizeCards(cards, input) {
  const accepted = [];
  const requestedType = input.options.requestedType;

  for (const raw of Array.isArray(cards) ? cards : []) {
    if (!raw || typeof raw !== "object") continue;
    const type = normalizeCardType(raw.type);
    const rawQuestion = cleanText(raw.question ?? raw.front, 1100);
    const question = polishMedicalText(rawQuestion);
    const answer = polishMedicalText(type === "cloze"
      ? cleanClozeAnswer(raw.answer ?? raw.back, rawQuestion)
      : cleanText(raw.answer ?? raw.back, 1400));
    const evidences = normalizeEvidences(raw, input);
    const card = {
      type,
      learningObjective: polishMedicalText(raw.learningObjective ?? raw.learning_objective ?? raw.objective),
      question,
      answer,
      explanation: polishMedicalText(raw.explanation ?? raw.rationale),
      topic: polishMedicalText(raw.topic ?? raw.subtopic) || polishMedicalText(input.deck.topic) || polishMedicalText(input.deck.title),
      tags: normalizeTags(raw.tags),
      difficulty: normalizeDifficulty(raw.difficulty),
      evidences,
    };

    if (type !== requestedType || !card.question || !card.answer || !card.learningObjective) continue;
    if (!passesAtomicityGuard(card)) continue;
    if (type === "cloze" && (!/\{\{c\d+::.+?\}\}/.test(card.question) || !passesClozeQualityGuard(card))) continue;
    if (evidences.length === 0) continue;
    if (hasObviousLanguageLeak(card)) continue;
    if (!passesSourceQualifierGuard(card)) continue;
    if (accepted.some((existing) => cardsAreSemanticDuplicates(existing, card))) continue;
    accepted.push(card);
    if (accepted.length >= input.options.cardCount) break;
  }

  return accepted;
}

export function extractGeminiText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (Array.isArray(data?.steps)) {
    const text = data.steps
      .filter((step) => step?.type === "model_output" && Array.isArray(step?.content))
      .flatMap((step) => step.content)
      .filter((content) => content?.type === "text" && typeof content?.text === "string")
      .map((content) => content.text)
      .join("")
      .trim();
    if (text) return text;
  }
  if (Array.isArray(data?.outputs)) {
    const text = data.outputs
      .filter((output) => output?.type === "text" && typeof output?.text === "string")
      .map((output) => output.text)
      .join("")
      .trim();
    if (text) return text;
  }
  return "";
}

function extractJsonCandidate(text) {
  let candidate = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) return candidate.slice(objectStart, objectEnd + 1);
  const arrayStart = candidate.indexOf("[");
  const arrayEnd = candidate.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) return candidate.slice(arrayStart, arrayEnd + 1);
  return candidate;
}

function parseJson(text) {
  const candidate = extractJsonCandidate(text);
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

export function parseModelCards(text) {
  const parsed = parseJson(text);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.cards)) return parsed.cards;
  if (Array.isArray(parsed?.flashcards)) return parsed.flashcards;
  return null;
}

export function parseValidationResults(text, expectedCount) {
  const parsed = parseJson(text);
  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  const byIndex = new Map();
  for (const item of results) {
    const index = Number(item?.index);
    if (!Number.isInteger(index) || index < 0 || index >= expectedCount) continue;
    byIndex.set(index, {
      index,
      accepted: item?.accepted === true,
      reason: cleanText(item?.reason, 280),
    });
  }
  if (byIndex.size !== expectedCount) return null;
  return Array.from({ length: expectedCount }, (_, index) => byIndex.get(index));
}

export function providerRetryAfterMs(response, errorText) {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  }
  try {
    const parsed = JSON.parse(errorText);
    const details = parsed?.error?.details;
    if (Array.isArray(details)) {
      const retry = details.find((item) => typeof item?.retryDelay === "string")?.retryDelay;
      const match = retry?.match(/([0-9.]+)s/);
      if (match) return Math.round(Number(match[1]) * 1000);
    }
  } catch {
    // Resposta de erro não JSON.
  }
  return undefined;
}

export async function callGemini({ apiKey, model, prompt, thinkingLevel, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        store: false,
        generation_config: { thinking_level: thinkingLevel },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function providerErrorResponse(status, errorText, retryAfterMs) {
  const transient = status === 408 || status === 429 || status >= 500;
  const publicStatus = status === 429 ? 429 : status === 408 ? 504 : status >= 500 ? 502 : 400;
  const message = status === 429
    ? "A IA está temporariamente no limite de requisições. O Fichário tentará novamente automaticamente."
    : transient
      ? "A IA ficou temporariamente indisponível neste passo."
      : `O Gemini recusou esta solicitação (erro ${status}).`;
  return json({
    error: message,
    code: `ai_provider_${status}`,
    transient,
    retryAfterMs,
    providerStatus: status,
  }, publicStatus);
}

async function executeGemini({ apiKey, model, prompt, thinkingLevel, timeoutMs, startedAt, label }) {
  let response;
  try {
    response = await callGemini({ apiKey, model, prompt, thinkingLevel, timeoutMs });
  } catch (error) {
    if (error?.name === "AbortError") {
      console.error(`${label}: timeout`, Date.now() - startedAt, "ms");
      return { errorResponse: json({
        error: "A IA demorou mais do que o esperado neste passo.",
        code: "ai_timeout",
        transient: true,
      }, 504) };
    }
    console.error(`${label}: falha de rede`, error);
    return { errorResponse: json({
      error: "Não foi possível alcançar a IA neste passo.",
      code: "ai_network_error",
      transient: true,
    }, 502) };
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${label}: Gemini erro`, response.status, errorText.slice(0, 1600));
    return { errorResponse: providerErrorResponse(response.status, errorText, providerRetryAfterMs(response, errorText)) };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { errorResponse: json({ error: "Resposta inválida da IA.", code: "invalid_ai_json", transient: true }, 502) };
  }
  const text = extractGeminiText(data);
  if (!text) {
    console.error(`${label}: sem texto`, JSON.stringify(data).slice(0, 1600));
    return { errorResponse: json({ error: "A IA não retornou conteúdo utilizável.", code: "empty_ai_response", transient: true }, 502) };
  }
  return { text };
}

async function handleGeneration(input, geminiApiKey, startedAt) {
  const type = input.options.requestedType;
  const clinical = type === "clinical_case";
  const model = clinical ? CLINICAL_MODEL : FAST_MODEL;
  const thinkingLevel = clinical ? "low" : "minimal";
  const timeoutMs = clinical ? CLINICAL_TIMEOUT_MS : FAST_TIMEOUT_MS;
  const prompt = buildGenerationPrompt(input);

  console.log("Flashcards: geração iniciada", JSON.stringify({
    model,
    type,
    characters: input.document.totalCharacters,
    pages: input.document.pages.length,
    requestedCards: input.options.cardCount,
    phase: input.options.generationPhase,
  }));

  const execution = await executeGemini({
    apiKey: geminiApiKey,
    model,
    prompt,
    thinkingLevel,
    timeoutMs,
    startedAt,
    label: `Flashcards ${type}`,
  });
  if (execution.errorResponse) return execution.errorResponse;

  const rawCards = parseModelCards(execution.text);
  if (!rawCards) {
    console.error("Flashcards: JSON inválido", execution.text.slice(0, 1600));
    return json({ error: "A IA respondeu em formato inválido.", code: "invalid_ai_json", transient: true }, 502);
  }

  const cards = sanitizeCards(rawCards, input);
  if (cards.length === 0) {
    console.error("Flashcards: nenhum card passou na validação local", JSON.stringify(rawCards).slice(0, 1600));
    return json({
      error: "Nenhum card deste lote passou na validação de fonte e qualidade.",
      code: "no_cards",
      transient: false,
    }, 422);
  }

  console.log("Flashcards: geração concluída", JSON.stringify({
    model,
    type,
    requestedCards: input.options.cardCount,
    returnedCards: cards.length,
    durationMs: Date.now() - startedAt,
  }));

  return json({ provider: "gemini", model, cards, generatedAt: new Date().toISOString() });
}

async function handleClinicalValidation(input, geminiApiKey, startedAt) {
  const sanitized = sanitizeCards(input.candidates, {
    ...input,
    options: { ...input.options, requestedType: "clinical_case", cardCount: Math.min(6, Math.max(1, input.candidates.length)) },
  });
  if (sanitized.length === 0) {
    return json({ error: "Os casos não chegaram válidos ao segundo revisor.", code: "no_cards", transient: false }, 422);
  }

  const prompt = buildClinicalValidatorPrompt(input, sanitized);
  console.log("Flashcards: validação clínica iniciada", JSON.stringify({
    model: VALIDATOR_MODEL,
    candidates: sanitized.length,
    characters: input.document.totalCharacters,
  }));

  const execution = await executeGemini({
    apiKey: geminiApiKey,
    model: VALIDATOR_MODEL,
    prompt,
    thinkingLevel: "low",
    timeoutMs: VALIDATOR_TIMEOUT_MS,
    startedAt,
    label: "Validador clínico",
  });
  if (execution.errorResponse) return execution.errorResponse;

  const results = parseValidationResults(execution.text, sanitized.length);
  if (!results) {
    console.error("Validador clínico: JSON inválido", execution.text.slice(0, 1600));
    return json({ error: "O segundo revisor respondeu em formato inválido.", code: "invalid_validator_json", transient: true }, 502);
  }

  const cards = sanitized.filter((_, index) => results[index]?.accepted);
  const rejected = results.filter((item) => !item.accepted).map((item) => ({ index: item.index, reason: item.reason }));

  console.log("Flashcards: validação clínica concluída", JSON.stringify({
    model: VALIDATOR_MODEL,
    accepted: cards.length,
    rejected: rejected.length,
    durationMs: Date.now() - startedAt,
  }));

  return json({
    provider: "gemini",
    model: VALIDATOR_MODEL,
    cards,
    rejected,
    generatedAt: new Date().toISOString(),
  });
}

export default async (request) => {
  const startedAt = Date.now();

  if (request.method !== "POST") return json({ error: "Método não permitido.", code: "method_not_allowed" }, 405);

  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken || !(await verifyFirebaseUser(idToken))) return json({ error: "Sessão inválida.", code: "unauthorized" }, 401);

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (!geminiApiKey) return json({ error: "A chave da IA não foi configurada.", code: "missing_ai_key" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Corpo da requisição inválido.", code: "invalid_json" }, 400);
  }

  const input = normalizeInput(body);
  if (!input.deck.title || !input.document.name || input.document.pages.length === 0) {
    return json({ error: "Faltam dados do deck ou do documento.", code: "invalid_payload" }, 400);
  }
  if (input.document.totalCharacters > MAX_REQUEST_CHARACTERS) {
    return json({ error: "Este lote ficou grande demais.", code: "batch_too_large" }, 413);
  }

  if (input.task === "validate_clinical") {
    return handleClinicalValidation(input, geminiApiKey, startedAt);
  }
  return handleGeneration(input, geminiApiKey, startedAt);
};
