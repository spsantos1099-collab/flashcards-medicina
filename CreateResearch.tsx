import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCreateFlow } from "../../contexts/CreateFlowContext";
import { useDecks } from "../../hooks/useDecks";
import {
  ResearchSearchError,
  searchMedicalSources,
  type ResearchSearchOptions,
} from "../../services/ai/searchMedicalSources";
import type { ResearchEvidenceLevel, ResearchSource, ResearchSourcePriority } from "../../types";

const SOURCE_GROUPS: Array<{
  id: ResearchSearchOptions["sourceGroups"][number];
  title: string;
  description: string;
}> = [
  {
    id: "guidelines",
    title: "Diretrizes e documentos oficiais",
    description: "PCDTs, Ministério da Saúde, CONITEC, consensos e sociedades médicas.",
  },
  {
    id: "reviews",
    title: "Sínteses de evidência",
    description: "Revisões sistemáticas, meta-análises e revisões clínicas de qualidade.",
  },
  {
    id: "primary",
    title: "Estudos primários",
    description: "Ensaios clínicos e estudos relevantes quando agregarem valor ao tema.",
  },
];

const EVIDENCE_LABELS: Record<ResearchEvidenceLevel, string> = {
  guideline: "Diretriz",
  consensus: "Consenso",
  official_document: "Documento oficial",
  systematic_review: "Revisão sistemática",
  meta_analysis: "Meta-análise",
  review: "Revisão",
  clinical_trial: "Ensaio clínico",
  observational: "Estudo observacional",
  other: "Fonte médica",
};

const PRIORITY_LABELS: Record<ResearchSourcePriority, string> = {
  priority: "Fonte prioritária",
  complementary: "Fonte complementar",
  international: "Fonte internacional",
};

function compactAuthors(authors?: string[]) {
  if (!authors?.length) return "";
  if (authors.length <= 2) return authors.join(" · ");
  return `${authors[0]} et al.`;
}

function sourceLabel(source: ResearchSource) {
  return EVIDENCE_LABELS[source.evidenceLevel] || "Fonte médica";
}

function priorityClasses(priority: ResearchSourcePriority) {
  if (priority === "priority") return "border-clinical-300 bg-clinical-50 text-clinical-700 dark:border-clinical-700 dark:bg-clinical-900/20 dark:text-clinical-200";
  if (priority === "international") return "border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/15 dark:text-amber-200";
}

function relevanceLabel(source: ResearchSource) {
  if (source.relevanceLevel === "high") return "Relevância alta";
  if (source.relevanceLevel === "medium") return "Relevância moderada";
  return null;
}

function relevanceClasses(source: ResearchSource) {
  if (source.relevanceLevel === "high") {
    return "border-clinical-200 bg-white/80 text-clinical-700 dark:border-clinical-800 dark:bg-clinical-700/20 dark:text-clinical-200";
  }
  return "border-ink-200 bg-white/70 text-ink-500 dark:border-ink-700 dark:bg-ink-950/20 dark:text-ink-300";
}

function breadthLabel(source: ResearchSource) {
  if (source.breadthLevel === "broad") return "Escopo amplo";
  if (source.breadthLevel === "focused") return "Escopo focado";
  if (source.breadthLevel === "narrow") return "Subtema específico";
  return null;
}

function breadthClasses(source: ResearchSource) {
  if (source.breadthLevel === "broad") {
    return "border-clinical-200 bg-clinical-50/70 text-clinical-700 dark:border-clinical-800 dark:bg-clinical-900/20 dark:text-clinical-200";
  }
  if (source.breadthLevel === "narrow") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/15 dark:text-amber-200";
  }
  return "border-ink-200 bg-white/70 text-ink-500 dark:border-ink-700 dark:bg-ink-950/20 dark:text-ink-300";
}

function languageBadge(source: ResearchSource) {
  const lang = (source.language || "").toLowerCase();
  const brazilian = source.country?.toLowerCase().includes("brasil") || source.domain.endsWith(".br");
  const portuguese = lang.includes("portugu") || lang.startsWith("pt");
  if (brazilian) return `🇧🇷 ${portuguese ? "Português" : (source.language || "Brasil")}`;
  if (portuguese) return "🇧🇷 Português";
  return `🌎 ${source.language || "Internacional"}`;
}

function chooseInitialResearchSources(sources: ResearchSource[], limit = 5) {
  const selected: ResearchSource[] = [];
  const selectedIds = new Set<string>();
  const institutionCounts = new Map<string, number>();

  const add = (source: ResearchSource) => {
    if (selected.length >= limit || selectedIds.has(source.id)) return false;
    const institutionKey = (source.institution || source.domain || "").toLowerCase().trim();
    const count = institutionCounts.get(institutionKey) || 0;
    if (institutionKey && count >= 2) return false;
    selected.push(source);
    selectedIds.add(source.id);
    if (institutionKey) institutionCounts.set(institutionKey, count + 1);
    return true;
  };

  const addPool = (pool: ResearchSource[], maxFromPool: number) => {
    let added = 0;
    for (const source of pool) {
      if (selected.length >= limit || added >= maxFromPool) break;
      if (add(source)) added += 1;
    }
  };

  const highUsable = sources.filter((source) =>
    source.relevanceLevel === "high"
    && source.breadthLevel !== "narrow"
    && source.officialContentClass !== "public_education"
    && !source.semanticRelation);
  const finalOfficial = highUsable.filter((source) =>
    (source.officialDocument || source.searchOrigin === "official")
    && !["preliminary", "recommendation_report"].includes(source.officialStatus || ""));
  const officialGuidelines = finalOfficial.filter((source) => ["guideline", "consensus"].includes(source.evidenceLevel));
  const officialClinicalReferences = finalOfficial.filter((source) => source.officialKind === "clinical_reference");
  const synthesis = highUsable.filter((source) => ["systematic_review", "meta_analysis"].includes(source.evidenceLevel));
  const broadReviews = highUsable.filter((source) => source.evidenceLevel === "review" && source.breadthLevel === "broad");

  // Composição documental defensiva: 1 diretriz/PCDT final + até 1 referência de sociedade
  // médica + sínteses/revisões abrangentes. Nunca seleciona automaticamente mais que `limit`.
  addPool(officialGuidelines, 1);
  addPool(officialClinicalReferences, 1);
  addPool(finalOfficial, 2);
  addPool(synthesis, 2);
  addPool(broadReviews, 2);
  addPool(highUsable, limit);
  const safeFallback = sources.filter((source) =>
    source.officialContentClass !== "public_education"
    && !source.semanticRelation);
  addPool(safeFallback.filter((source) => source.relevanceLevel === "high"), limit);
  addPool(safeFallback, limit);

  // Fontes de relação indireta e conteúdo meramente informativo ficam visíveis, mas não
  // são marcadas automaticamente antes da leitura/validação documental.
  return selected.slice(0, limit);
}

export default function CreateResearch() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { decks, loading: decksLoading } = useDecks(user?.uid);
  const {
    targetDeckId,
    setTargetDeckId,
    researchTopic,
    setResearchTopic,
    researchSources,
    setResearchSources,
    selectedResearchSourceIds,
    setSelectedResearchSourceIds,
    researchSearchMeta,
    setResearchSearchMeta,
  } = useCreateFlow();

  const [sourceGroups, setSourceGroups] = useState<ResearchSearchOptions["sourceGroups"]>([
    "guidelines",
    "reviews",
  ]);
  const [recency, setRecency] = useState<ResearchSearchOptions["recency"]>("5y");
  const [maxResults, setMaxResults] = useState(12);
  const [allowInternational, setAllowInternational] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const requestedDeckId = searchParams.get("deckId");
    if (!requestedDeckId || decksLoading) return;
    if (decks.some((deck) => deck.id === requestedDeckId)) setTargetDeckId(requestedDeckId);
  }, [decks, decksLoading, searchParams, setTargetDeckId]);

  useEffect(() => {
    if (!targetDeckId && decks.length === 1) setTargetDeckId(decks[0].id);
  }, [decks, setTargetDeckId, targetDeckId]);

  const selectedDeck = decks.find((deck) => deck.id === targetDeckId);
  const selectedSources = useMemo(
    () => researchSources.filter((source) => selectedResearchSourceIds.includes(source.id)),
    [researchSources, selectedResearchSourceIds],
  );
  const portugueseSources = useMemo(
    () => researchSources.filter((source) => source.priority !== "international").length,
    [researchSources],
  );

  const toggleGroup = (group: ResearchSearchOptions["sourceGroups"][number]) => {
    setSourceGroups((current) => current.includes(group)
      ? current.filter((item) => item !== group)
      : [...current, group]);
  };

  const toggleSource = (sourceId: string) => {
    setSelectedResearchSourceIds(
      selectedResearchSourceIds.includes(sourceId)
        ? selectedResearchSourceIds.filter((id) => id !== sourceId)
        : [...selectedResearchSourceIds, sourceId],
    );
  };

  const handleSearch = async () => {
    if (!user || !targetDeckId || searching) return;
    setSearching(true);
    setSearchError(null);
    setResearchSources([]);
    setSelectedResearchSourceIds([]);
    setResearchSearchMeta(null);

    try {
      const result = await searchMedicalSources({
        user,
        options: {
          topic: researchTopic,
          sourceGroups,
          recency,
          maxResults,
          allowInternational,
        },
      });
      setResearchSources(result.sources);
      setResearchSearchMeta(result.meta);

      // A API já devolve as fontes na ordem final de qualidade. A seleção automática
      // monta uma base documental DIVERSA: oficiais/diretrizes + sínteses de evidência +
      // revisões abrangentes, evitando cinco documentos quase equivalentes.
      const initial = chooseInitialResearchSources(result.sources, 5);
      const initialIds = Array.from(new Set(initial.map((source) => source.id))).slice(0, 5);
      setSelectedResearchSourceIds(initialIds);
    } catch (error) {
      console.error("Pesquisa de fontes falhou.", error);
      setSearchError(error instanceof ResearchSearchError
        ? error.message
        : "Não foi possível pesquisar fontes agora. Tente novamente.");
    } finally {
      setSearching(false);
    }
  };

  const canSearch = Boolean(user && targetDeckId && researchTopic.trim().length >= 3 && sourceGroups.length && !searching);

  return (
    <div className="max-w-4xl">
      <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">CRIAR COM IA · PESQUISAR POR TEMA</div>
      <h1 className="font-display text-3xl text-ink-900 dark:text-paper mb-1">Pesquisar fontes médicas</h1>
      <p className="text-ink-400 mb-7 max-w-3xl">
        Pesquise o tema em português. O Fichário reúne candidatos de fontes brasileiras e, quando habilitado, internacionais, compara a qualidade clínica e mostra as melhores opções.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-7">
        <Link
          to={targetDeckId ? `/create/upload?deckId=${targetDeckId}` : "/create/upload"}
          className="rounded-card border border-ink-200 dark:border-ink-800 p-4 hover:border-clinical-300 transition-colors"
        >
          <div className="source-tab">MEU MATERIAL</div>
          <div className="font-display text-lg text-ink-900 dark:text-paper mt-1">Enviar PDF ou DOCX</div>
          <p className="text-sm text-ink-400 mt-1">Use um documento próprio como fonte dos flashcards.</p>
        </Link>
        <div className="rounded-card border border-clinical-500 bg-clinical-50/60 dark:bg-clinical-700/15 p-4">
          <div className="source-tab text-clinical-700 dark:text-clinical-200">ATIVO</div>
          <div className="font-display text-lg text-ink-900 dark:text-paper mt-1">Pesquisar por tema</div>
          <p className="text-sm text-ink-400 mt-1">Fontes oficiais, PDFs, Google Search, OpenAlex e PubMed com ranking clínico de relevância, autoridade, evidência e abrangência.</p>
        </div>
      </div>

      <section className="rounded-card border border-ink-200 dark:border-ink-800 bg-white/70 dark:bg-ink-900/40 p-5 sm:p-6">
        <div className="grid lg:grid-cols-[1fr_240px] gap-5">
          <div>
            <label htmlFor="research-topic" className="block text-sm font-medium text-ink-700 dark:text-ink-100 mb-2">
              Tema médico
            </label>
            <input
              id="research-topic"
              value={researchTopic}
              onChange={(event) => setResearchTopic(event.target.value)}
              placeholder="Ex.: Dermatite atópica em adultos"
              className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3.5 py-3 text-sm text-ink-900 dark:text-paper outline-none focus:border-clinical-500"
            />
            <p className="text-xs text-ink-400 mt-1.5">Pode escrever normalmente em português. Não é necessário traduzir o tema para inglês.</p>
          </div>
          <div>
            <label htmlFor="research-deck" className="block text-sm font-medium text-ink-700 dark:text-ink-100 mb-2">
              Deck de destino
            </label>
            {decks.length ? (
              <select
                id="research-deck"
                value={targetDeckId ?? ""}
                onChange={(event) => setTargetDeckId(event.target.value || null)}
                className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3.5 py-3 text-sm text-ink-900 dark:text-paper outline-none focus:border-clinical-500"
              >
                <option value="">Selecione</option>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>{deck.specialty} · {deck.title}</option>
                ))}
              </select>
            ) : (
              <Link to="/library" className="text-sm text-clinical-600 dark:text-clinical-300">Criar um deck primeiro →</Link>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-clinical-200 dark:border-clinical-800 bg-clinical-50/50 dark:bg-clinical-900/10 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="source-tab text-clinical-700 dark:text-clinical-200">IDIOMA DAS FONTES</div>
              <div className="text-sm font-medium text-ink-800 dark:text-paper mt-1">Português do Brasil é a prioridade</div>
              <p className="text-xs text-ink-400 mt-1">Ministério da Saúde, CONITEC, sociedades médicas, BVS/LILACS e SciELO vêm antes de fontes internacionais equivalentes.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-200 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={allowInternational}
                onChange={(event) => setAllowInternational(event.target.checked)}
                className="h-4 w-4 accent-clinical-600"
              />
              Comparar também fontes internacionais
            </label>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm font-medium text-ink-700 dark:text-ink-100 mb-2">Tipos de fonte</div>
          <div className="grid md:grid-cols-3 gap-2.5">
            {SOURCE_GROUPS.map((group) => {
              const active = sourceGroups.includes(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`text-left rounded-lg border p-3.5 transition-colors ${active
                    ? "border-clinical-500 bg-clinical-50/70 dark:bg-clinical-900/20"
                    : "border-ink-200 dark:border-ink-800 hover:border-ink-300"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] ${active
                      ? "border-clinical-600 bg-clinical-600 text-white"
                      : "border-ink-300 dark:border-ink-700"}`}>{active ? "✓" : ""}</span>
                    <span className="text-sm font-medium text-ink-800 dark:text-paper">{group.title}</span>
                  </div>
                  <p className="text-xs text-ink-400 mt-1.5 leading-relaxed">{group.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-5">
          <div>
            <label htmlFor="research-recency" className="block text-sm font-medium text-ink-700 dark:text-ink-100 mb-2">Recência</label>
            <select
              id="research-recency"
              value={recency}
              onChange={(event) => setRecency(event.target.value as ResearchSearchOptions["recency"])}
              className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3.5 py-3 text-sm"
            >
              <option value="5y">Últimos 5 anos</option>
              <option value="10y">Últimos 10 anos</option>
              <option value="all">Sem limite de data</option>
            </select>
          </div>
          <div>
            <label htmlFor="research-count" className="block text-sm font-medium text-ink-700 dark:text-ink-100 mb-2">Quantidade de fontes</label>
            <select
              id="research-count"
              value={maxResults}
              onChange={(event) => setMaxResults(Number(event.target.value))}
              className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3.5 py-3 text-sm"
            >
              <option value={8}>Até 8</option>
              <option value={12}>Até 12</option>
              <option value={20}>Até 20</option>
            </select>
          </div>
        </div>

        {searchError && (
          <div className="mt-5 rounded-lg border border-signal-400/40 bg-signal-400/10 px-4 py-3 text-sm text-signal-600 dark:text-signal-400">
            {searchError}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={!canSearch}
          className="mt-6 w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-3 text-sm font-medium disabled:opacity-40"
        >
          {searching ? "Pesquisando fontes médicas…" : "Pesquisar fontes verificáveis"}
        </button>
      </section>

      {researchSearchMeta && (
        <section className="mt-7">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <div className="source-tab text-clinical-600 dark:text-clinical-300">
                {researchSearchMeta.searchMode === "grounded_web"
                  ? "FONTES ENCONTRADAS · WEB + FONTES OFICIAIS"
                  : researchSearchMeta.searchMode === "indexed_fallback"
                    ? "FONTES ENCONTRADAS · OFICIAIS + BASES CIENTÍFICAS ABERTAS"
                    : "FONTES ENCONTRADAS · CONTINGÊNCIA PUBMED"}
              </div>
              <h2 className="font-display text-2xl text-ink-900 dark:text-paper mt-1">Escolha a base documental</h2>
              <p className="text-sm text-ink-400 mt-1">
                Tema: <strong className="font-medium text-ink-600 dark:text-ink-200">{researchSearchMeta.normalizedTopic}</strong>
              </p>
            </div>
            <div className="text-sm text-ink-400">
              {researchSources.length} fontes exibidas · {portugueseSources} em português/brasileiras
            </div>
          </div>

          {researchSearchMeta.fallbackUsed && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 dark:bg-amber-900/10 px-4 py-3 mb-4 text-sm text-ink-600 dark:text-ink-200">
              <strong className="font-medium">Modo de contingência ativo.</strong> {researchSearchMeta.fallbackReason}
              <span className="block mt-1 text-xs text-ink-400">Você não precisa traduzir nem alterar o tema. Mesmo sem a Pesquisa Google, o Fichário continua consultando diretamente fontes oficiais brasileiras e bases científicas abertas.</span>
              {researchSearchMeta.semanticInternationalQuery && (
                <span className="block mt-1 text-xs text-ink-400">
                  {researchSearchMeta.meshUsed
                    ? (researchSearchMeta.semanticQueryFirstUsed ? "Canonicalização clínica query-first (MeSH/NLM)" : "Canonicalização clínica MeSH/NLM")
                    : "Expansão semântica de contingência"}: <strong className="font-medium">{researchSearchMeta.semanticInternationalQuery}</strong>
                  {researchSearchMeta.meshNuclearDescriptor && <> · conceito nuclear: <strong className="font-medium">{researchSearchMeta.meshNuclearDescriptor}</strong></>}
                </span>
              )}
              {researchSearchMeta.semanticQueryFirstUsed && ((researchSearchMeta.semanticPubMedQueries?.length || 0) > 1 || (researchSearchMeta.semanticOpenAlexQueries?.length || 0) > 1) && (
                <span className="block mt-1 text-xs text-ink-400">Busca internacional progressiva ativa: o Fichário tenta primeiro a forma clínica mais específica e só relaxa para o conceito nuclear quando faltam resultados adequados.</span>
              )}
              {researchSearchMeta.semanticLanguageFallbackUsed && (
                <span className="block mt-1 text-xs text-ink-400">A semente científica em português foi insuficiente; o OpenAlex também foi consultado sem filtro de idioma antes da canonicalização clínica.</span>
              )}
            </div>
          )}

          {!researchSearchMeta.fallbackUsed && portugueseSources === 0 && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 dark:bg-amber-900/10 px-4 py-3 mb-4 text-sm text-ink-600 dark:text-ink-200">
              Não foi encontrada uma fonte brasileira adequada nesta rodada. O Fichário mostrou apenas complementos internacionais em vez de classificar páginas fracas como fontes médicas.
            </div>
          )}

          {researchSearchMeta.officialSearchUsed && (
            <div className="rounded-lg border border-clinical-200 bg-clinical-50/50 dark:border-clinical-700 dark:bg-clinical-700/10 px-4 py-3 mb-4 text-sm text-ink-600 dark:text-ink-200">
              <strong className="font-medium">Busca oficial direta ativa.</strong> O Fichário consultou gov.br/Ministério da Saúde/CONITEC/PCDT e detectou automaticamente as sociedades de especialidade pertinentes ao tema, procurando também documentos em PDF.
              <span className="block mt-1 text-xs text-ink-400">{researchSearchMeta.officialCandidateCount === 1
                ? "1 documento oficial foi aberto, validado e entrou na comparação antes do ranking final."
                : `${researchSearchMeta.officialCandidateCount || 0} documentos oficiais foram abertos, validados e entraram na comparação antes do ranking final.`}</span>
              {!!researchSearchMeta.officialAuthorities?.length && (
                <span className="block mt-1 text-xs text-ink-400">
                  Especialidade{researchSearchMeta.officialAuthorities.length === 1 ? "" : "s"} detectada{researchSearchMeta.officialAuthorities.length === 1 ? "" : "s"}: {researchSearchMeta.officialAuthorities.map((authority) => authority.specialty).join(" · ")}
                </span>
              )}
            </div>
          )}

          <div className="rounded-lg border border-clinical-200 bg-clinical-50/50 dark:border-clinical-700 dark:bg-clinical-700/10 px-4 py-3 mb-4 text-sm text-ink-600 dark:text-ink-200">
            <strong className="font-medium">Filtro clínico de relevância ativo.</strong> Resultados fora do tema, com população incompatível ou de contexto veterinário são descartados antes de aparecerem aqui.
          </div>

          {researchSources.length === 0 ? (
            <div className="rounded-card border border-dashed border-ink-200 dark:border-ink-800 p-8 text-center">
              <h3 className="font-display text-xl text-ink-900 dark:text-paper">Nenhuma fonte confiável encontrada</h3>
              <p className="text-sm text-ink-400 mt-2">Tente ampliar a data ou tornar o tema um pouco mais geral. Não é necessário escrever em inglês.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {researchSources.map((source) => {
                const selected = selectedResearchSourceIds.includes(source.id);
                return (
                  <article
                    key={source.id}
                    className={`rounded-card border p-4 sm:p-5 transition-colors ${selected
                      ? "border-clinical-400 bg-clinical-50/40 dark:bg-clinical-900/10"
                      : "border-ink-200 dark:border-ink-800 bg-white/70 dark:bg-ink-900/40"}`}
                  >
                    <div className="flex gap-3.5">
                      <button
                        type="button"
                        onClick={() => toggleSource(source.id)}
                        aria-label={selected ? "Remover fonte da seleção" : "Selecionar fonte"}
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center text-xs ${selected
                          ? "border-clinical-600 bg-clinical-600 text-white"
                          : "border-ink-300 dark:border-ink-700"}`}
                      >
                        {selected ? "✓" : ""}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityClasses(source.priority)}`}>
                            {PRIORITY_LABELS[source.priority]}
                          </span>
                          {relevanceLabel(source) && (
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${relevanceClasses(source)}`}>
                              {relevanceLabel(source)}
                            </span>
                          )}
                          {breadthLabel(source) && (
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${breadthClasses(source)}`}>
                              {breadthLabel(source)}
                            </span>
                          )}
                          {source.officialDocument && (
                            <span className="rounded-full border border-clinical-300 bg-clinical-50 px-2 py-0.5 text-[11px] font-medium text-clinical-700 dark:border-clinical-700 dark:bg-clinical-900/20 dark:text-clinical-200">OFICIAL</span>
                          )}
                          {source.officialContentClass === "public_education" && (
                            <span className="rounded-full border border-ink-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">INFORMATIVO</span>
                          )}
                          {source.semanticRelation && (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">RELAÇÃO INDIRETA</span>
                          )}
                          {source.isPdf && (
                            <span className="rounded-full border border-ink-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">PDF</span>
                          )}
                          {source.officialStatus === "preliminary" && (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">PRELIMINAR</span>
                          )}
                          {source.officialStatus === "summary" && (
                            <span className="rounded-full border border-ink-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">RESUMIDO</span>
                          )}
                          <span className="source-tab text-clinical-700 dark:text-clinical-200">{sourceLabel(source)}</span>
                          <span className="text-xs text-ink-400">{languageBadge(source)}</span>
                          {source.year && <span className="text-xs text-ink-400">{source.year}</span>}
                        </div>

                        <h3 className="font-medium text-ink-900 dark:text-paper leading-snug">{source.title}</h3>
                        <p className="text-sm text-ink-500 dark:text-ink-300 mt-2">{source.institution}</p>
                        {compactAuthors(source.authors) && <p className="text-xs text-ink-400 mt-1">{compactAuthors(source.authors)}</p>}

                        {source.summary && (
                          <p className="text-sm text-ink-500 dark:text-ink-300 mt-3 leading-relaxed">{source.summary}</p>
                        )}
                        {source.whyRelevant && (
                          <p className="text-xs text-ink-400 mt-2"><strong className="font-medium text-ink-500 dark:text-ink-300">Por que entrou:</strong> {source.whyRelevant}</p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-clinical-700 dark:text-clinical-300 hover:underline"
                          >
                            Abrir fonte ↗
                          </a>
                          <span className="text-ink-400">{source.domain}</span>
                          {source.pmid && <span className="text-ink-400">PMID {source.pmid}</span>}
                          {source.doi && <span className="text-ink-400">DOI {source.doi}</span>}
                          {source.originPageUrl && (
                            <a href={source.originPageUrl} target="_blank" rel="noreferrer" className="text-clinical-600 hover:underline">Página oficial ↗</a>
                          )}
                          <span className="text-ink-400">{source.verificationStatus === "verified" ? "✓ URL verificada" : "✓ Resultado ancorado na pesquisa"}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {researchSources.length > 0 && (
            <div className="sticky bottom-4 mt-5 rounded-card border border-ink-200 dark:border-ink-700 bg-paper/95 dark:bg-ink-950/95 backdrop-blur p-4 shadow-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-ink-800 dark:text-paper">{selectedSources.length} fonte{selectedSources.length === 1 ? "" : "s"} selecionada{selectedSources.length === 1 ? "" : "s"}</div>
                <p className="text-xs text-ink-400 mt-1">Nesta fase você escolhe a base documental. A geração dos flashcards será conectada na próxima etapa.</p>
              </div>
              <div className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${selectedSources.length
                ? "border-clinical-300 dark:border-clinical-700 bg-clinical-50 dark:bg-clinical-900/20 text-clinical-700 dark:text-clinical-200"
                : "border-ink-200 dark:border-ink-800 text-ink-400"}`}>
                {selectedSources.length ? "✓ Seleção guardada nesta sessão" : "Selecione pelo menos uma fonte"}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mt-7 rounded-card border border-ink-200 dark:border-ink-800 p-4 text-xs text-ink-400 leading-relaxed">
        <strong className="text-ink-600 dark:text-ink-200 font-medium">Rastreabilidade:</strong> o Fichário consulta diretamente fontes oficiais brasileiras e valida a URL final antes de promovê-la a fonte documental; páginas de busca, categoria, evento, notícia e campanha servem apenas para descoberta. Google Search, OpenAlex e PubMed complementam a pesquisa quando disponíveis.
        {selectedDeck && <span> Deck selecionado: {selectedDeck.title}.</span>}
      </div>
    </div>
  );
}
