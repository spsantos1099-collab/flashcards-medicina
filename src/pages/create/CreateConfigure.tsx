import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCreateFlow } from "../../contexts/CreateFlowContext";
import { useDecks } from "../../hooks/useDecks";
import { AIGenerationError, generateFlashcardsFromDocument, type GenerationProgress } from "../../services/ai/generateFlashcards";
import type { CardType, GenerationOptions } from "../../types";

const AMOUNTS = [
  { id: "essential", label: "Essencial", description: "Só o que tem alto valor de prova ou muda conduta.", count: 8 },
  { id: "balanced", label: "Equilibrada", description: "Diagnóstico, conduta, critérios e números importantes.", count: 15 },
  { id: "detailed", label: "Detalhada", description: "Cobertura ampla, incluindo exceções e pontos de segunda linha.", count: 30 },
  { id: "custom", label: "Personalizada", description: "Você define o número-alvo de cards.", count: 15 },
] as const;

type AmountMode = (typeof AMOUNTS)[number]["id"];

const CARD_TYPES: Array<{ id: CardType; label: string }> = [
  { id: "basic", label: "Básico" },
  { id: "cloze", label: "Cloze" },
  { id: "clinical_case", label: "Caso clínico" },
];

const PRIORITIES = [
  "Conduta e decisão clínica",
  "Conceitos fundamentais",
  "Diagnóstico",
  "Tratamento",
  "Casos clínicos",
  "Valores e critérios",
  "Pegadinhas de prova",
];

function number(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default function CreateConfigure() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { decks } = useDecks(user?.uid);
  const {
    file,
    targetDeckId,
    documentRecord,
    extractedDocument,
    setGeneratedCards,
    setGenerationMeta,
  } = useCreateFlow();
  const [amount, setAmount] = useState<AmountMode>("balanced");
  const [customCount, setCustomCount] = useState<number | "">(15);
  const [types, setTypes] = useState<CardType[]>(["basic", "cloze"]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const deck = decks.find((item) => item.id === targetDeckId);
  const selectedAmount = useMemo(() => AMOUNTS.find((item) => item.id === amount), [amount]);
  const normalizedCustomCount = customCount === "" ? 3 : Math.max(3, Math.min(40, customCount));
  const cardCount = amount === "custom" ? normalizedCustomCount : selectedAmount?.count ?? 15;

  const toggleType = (type: CardType) => {
    setTypes((current) => current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type]);
  };

  const togglePriority = (priority: string) => {
    setPriorities((current) => current.includes(priority)
      ? current.filter((item) => item !== priority)
      : [...current, priority]);
  };

  const handleGenerate = async () => {
    if (!user || !deck || !extractedDocument || types.length === 0) return;

    setGenerating(true);
    setGenerationError(null);
    setGenerationProgress(null);
    setGeneratedCards([]);
    setGenerationMeta(null);

    const options: GenerationOptions = {
      amountMode: amount,
      cardCount,
      cardTypes: types,
      priorities,
    };

    try {
      const result = await generateFlashcardsFromDocument({
        user,
        deck,
        document: extractedDocument,
        options,
        onProgress: setGenerationProgress,
      });

      setGeneratedCards(result.cards);
      setGenerationMeta(result.meta);
      navigate("/create/review");
    } catch (error) {
      console.error("Não foi possível gerar os flashcards.", error);
      setGenerationError(
        error instanceof AIGenerationError
          ? error.message
          : "Não foi possível gerar os flashcards agora. Tente novamente.",
      );
    } finally {
      setGenerating(false);
      setGenerationProgress(null);
    }
  };

  if (!file || !targetDeckId || !documentRecord || !extractedDocument) {
    return (
      <div className="max-w-xl">
        <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">CRIAR COM IA · MEU MATERIAL</div>
        <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-2">Selecione o material novamente</h1>
        <p className="text-ink-400 mb-6">
          Por privacidade, o Fichário mantém o arquivo e o texto extraído somente nesta sessão do navegador. Se a página foi atualizada, selecione o PDF/DOCX novamente.
        </p>
        <Link
          to={targetDeckId ? `/create/upload?deckId=${targetDeckId}` : "/create/upload"}
          className="inline-flex rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium"
        >
          Voltar e selecionar arquivo
        </Link>
      </div>
    );
  }

  const sourceDetail = extractedDocument.extension === "pdf"
    ? `${number(extractedDocument.pageCount ?? 0)} páginas · ${number(extractedDocument.pagesWithText ?? 0)} com texto`
    : "Documento Word com texto extraível";

  return (
    <div className="max-w-xl">
      <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">ETAPA 2 · CONFIGURAÇÃO</div>
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-1">Configurar geração</h1>
      <p className="text-ink-400 mb-1 break-words">{file.name}</p>
      {deck && <p className="text-sm text-ink-400 mb-6">Deck: {deck.specialty} · {deck.title}</p>}

      <div className="rounded-card border border-clinical-300 dark:border-clinical-700/60 bg-clinical-50/60 dark:bg-clinical-700/10 px-4 py-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="source-tab text-clinical-700 dark:text-clinical-200">CONTEÚDO EXTRAÍDO ✓</div>
            <p className="font-medium text-ink-900 dark:text-paper mt-1">{sourceDetail}</p>
            <p className="text-sm text-ink-400 mt-1">
              {number(extractedDocument.wordCount)} palavras · {number(extractedDocument.characterCount)} caracteres
            </p>
          </div>
          <div className="rounded-full border border-clinical-300 dark:border-clinical-700 px-2.5 py-1 source-tab text-clinical-700 dark:text-clinical-200 shrink-0">
            LOCAL
          </div>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-200 mt-3">
          O Firebase guarda apenas as métricas acima; o conteúdo do documento não é salvo no banco.
        </p>
      </div>

      {extractedDocument.warnings.length > 0 && (
        <div className="rounded-card border border-amber-300/70 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 mb-4">
          <div className="source-tab text-amber-800 dark:text-amber-300">ATENÇÃO NA EXTRAÇÃO</div>
          {extractedDocument.warnings.map((warning) => (
            <p key={warning} className="text-sm text-amber-900/80 dark:text-amber-100/80 mt-1">{warning}</p>
          ))}
        </div>
      )}

      <div className="rounded-card border border-ink-200/70 dark:border-ink-800 mb-7 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPreview((current) => !current)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
        >
          <div>
            <div className="source-tab">CONFERIR LEITURA</div>
            <div className="text-sm font-medium text-ink-800 dark:text-paper mt-1">
              {showPreview ? "Ocultar amostra" : "Ver amostra do texto extraído"}
            </div>
          </div>
          <span className="text-ink-400">{showPreview ? "−" : "+"}</span>
        </button>
        {showPreview && (
          <div className="border-t border-ink-200/70 dark:border-ink-800 bg-white/70 dark:bg-ink-950/40 px-4 py-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-ink-500 dark:text-ink-200 max-h-72 overflow-y-auto">
              {extractedDocument.fullText.slice(0, 3500)}
              {extractedDocument.fullText.length > 3500 ? "\n\n[…]" : ""}
            </pre>
          </div>
        )}
      </div>

      <div className="rounded-card border border-ink-200/70 dark:border-ink-800 px-4 py-3.5 mb-7">
        <div className="source-tab text-clinical-600 dark:text-clinical-300">RASTREABILIDADE</div>
        <p className="text-sm text-ink-400 mt-1">
          {extractedDocument.extension === "pdf"
            ? "As páginas foram preservadas separadamente. Cada card gerado deverá apontar para a página e para um trecho do PDF usado como fonte."
            : "O DOCX não possui paginação fixa confiável. Cada card citará o documento e um trecho usado como fonte."}
        </p>
      </div>

      <h2 className="font-display text-lg text-ink-900 dark:text-paper mb-3">Quantidade</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {AMOUNTS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setAmount(opt.id)}
            className={`text-left rounded-lg border p-3.5 transition-colors ${
              amount === opt.id
                ? "border-clinical-500 bg-clinical-50 dark:bg-clinical-700/20"
                : "border-ink-200 dark:border-ink-800 hover:bg-ink-50 dark:hover:bg-ink-800/50"
            }`}
          >
            <div className="font-medium text-sm text-ink-900 dark:text-paper">{opt.label}</div>
            <div className="text-xs text-ink-400 mt-0.5">{opt.description}</div>
            {opt.id !== "custom" && <div className="source-tab mt-2">≈ {opt.count} CARDS</div>}
          </button>
        ))}
      </div>

      {amount === "custom" && (
        <div className="mb-8">
          <label htmlFor="custom-card-count" className="block text-sm font-medium text-ink-700 dark:text-ink-100 mb-2">
            Quantos cards? <span className="text-ink-400 font-normal">(3 a 40)</span>
          </label>
          <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 focus-within:border-clinical-500">
            <button
              type="button"
              aria-label="Diminuir quantidade de cards"
              onClick={() => setCustomCount((current) => Math.max(3, (current === "" ? 3 : current) - 1))}
              className="w-11 text-xl leading-none text-ink-600 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800 active:bg-ink-100 dark:active:bg-ink-700"
            >
              −
            </button>
            <input
              id="custom-card-count"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={customCount}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const digitsOnly = event.target.value.replace(/\D/g, "");
                if (digitsOnly === "") {
                  setCustomCount("");
                  return;
                }

                setCustomCount(Math.min(40, Number(digitsOnly)));
              }}
              onBlur={() => {
                if (customCount === "" || customCount < 3) setCustomCount(3);
              }}
              aria-label="Quantidade personalizada de flashcards"
              className="w-20 border-x border-ink-200 dark:border-ink-700 bg-transparent px-2 py-2.5 text-center text-base font-medium outline-none"
            />
            <button
              type="button"
              aria-label="Aumentar quantidade de cards"
              onClick={() => setCustomCount((current) => Math.min(40, (current === "" ? 3 : current) + 1))}
              className="w-11 text-xl leading-none text-ink-600 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800 active:bg-ink-100 dark:active:bg-ink-700"
            >
              +
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-400">Use − e + ou toque no número e digite de 3 a 40.</p>
        </div>
      )}
      {amount !== "custom" && <div className="mb-8" />}

      <h2 className="font-display text-lg text-ink-900 dark:text-paper mb-3">Tipos de card</h2>
      <div className="flex flex-wrap gap-2 mb-2">
        {CARD_TYPES.map((type) => (
          <Chip key={type.id} label={type.label} active={types.includes(type.id)} onClick={() => toggleType(type.id)} />
        ))}
      </div>
      {types.length === 0 && <p className="text-sm text-signal-600 dark:text-signal-300 mb-8">Selecione pelo menos um tipo de card.</p>}
      {types.length > 0 && <div className="mb-8" />}

      <h2 className="font-display text-lg text-ink-900 dark:text-paper mb-3">Priorizar</h2>
      <div className="flex flex-wrap gap-2 mb-8">
        {PRIORITIES.map((priority) => (
          <Chip
            key={priority}
            label={priority}
            active={priorities.includes(priority)}
            onClick={() => togglePriority(priority)}
          />
        ))}
      </div>

      <div className="rounded-card border border-clinical-300 dark:border-clinical-700/60 bg-clinical-50/50 dark:bg-clinical-700/10 px-4 py-4">
        <div className="source-tab text-clinical-700 dark:text-clinical-200">IA CONECTADA · GEMINI 3.5</div>
      </div>

      {generating && generationProgress && (
        <div className="mt-4 rounded-lg border border-ink-200/70 dark:border-ink-800 bg-white/60 dark:bg-ink-950/30 px-3.5 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-ink-800 dark:text-paper">
              {generationProgress.stage === "retrying"
                ? `Reconectando à IA · tentativa ${generationProgress.retryAttempt ?? 2}`
                : generationProgress.stage === "validating"
                  ? "Revisando casos clínicos"
                  : generationProgress.stage === "refill"
                    ? `Completando seleção · rodada ${generationProgress.refillRound ?? 1}`
                    : generationProgress.currentType === "clinical_case"
                      ? "Construindo casos clínicos"
                      : generationProgress.currentType === "cloze"
                        ? "Gerando cards Cloze"
                        : "Gerando cards básicos"}
            </span>
            <span className="source-tab text-clinical-600 dark:text-clinical-300">
              {generationProgress.generatedCards}/{generationProgress.targetCards} CARDS
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div
              className="h-full bg-clinical-500 transition-all"
              style={{ width: `${Math.max(6, Math.min(100, (generationProgress.generatedCards / generationProgress.targetCards) * 100))}%` }}
            />
          </div>
          <p className="text-xs text-ink-400 mt-2">O Fichário preserva os cards aprovados, evita repetições e tenta completar a seleção automaticamente.</p>
        </div>
      )}

      {generationError && (
        <div className="mt-4 rounded-lg border border-signal-300/60 bg-signal-400/10 px-3.5 py-3 text-sm text-signal-700 dark:text-signal-300">
          <div className="font-medium">A geração não foi concluída.</div>
          <div className="mt-1">{generationError}</div>
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !deck || types.length === 0}
        className="mt-6 w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-3 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {generating
          ? generationProgress
            ? generationProgress.stage === "retrying"
              ? "Tentando novamente automaticamente..."
              : generationProgress.stage === "validating"
                ? "Revisando casos clínicos..."
                : generationProgress.stage === "refill"
                  ? `Completando ${generationProgress.generatedCards}/${generationProgress.targetCards} cards...`
                  : generationProgress.currentType === "clinical_case"
                    ? "Construindo casos clínicos..."
                    : `Gerando ${generationProgress.generatedCards}/${generationProgress.targetCards} cards...`
            : "Preparando geração..."
          : `Gerar ${cardCount} flashcards`}
      </button>

      <Link
        to={`/create/upload?deckId=${targetDeckId}`}
        className="block text-center mt-3 text-sm text-clinical-600 dark:text-clinical-300"
      >
        Trocar documento
      </Link>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? "border-clinical-500 bg-clinical-50 text-clinical-700 dark:bg-clinical-700/20 dark:text-clinical-100"
          : "border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800/50"
      }`}
    >
      {label}
    </button>
  );
}
