import { useState } from "react";
import { Link } from "react-router-dom";
import ClozeText from "../../components/ClozeText";
import { useCreateFlow } from "../../contexts/CreateFlowContext";
import type { Flashcard } from "../../types";

const TYPE_LABELS = {
  basic: "BÁSICO",
  cloze: "CLOZE",
  clinical_case: "CASO CLÍNICO",
} as const;

const DIFFICULTY_LABELS = {
  easy: "Fácil",
  medium: "Média",
  hard: "Difícil",
} as const;

export default function CreateReview() {
  const { generatedCards, generationMeta, targetDeckId } = useCreateFlow();

  if (generatedCards.length === 0 || !generationMeta) {
    return (
      <div className="max-w-xl">
        <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">ETAPA 3 · REVISÃO</div>
        <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-2">Nenhuma geração nesta sessão</h1>
        <p className="text-ink-400 mb-6">
          Os cards gerados ficam somente na memória do navegador nesta fase. Volte à configuração e gere novamente.
        </p>
        <Link
          to={targetDeckId ? `/create/upload?deckId=${targetDeckId}` : "/create/upload"}
          className="inline-flex rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium"
        >
          Voltar para criação
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">ETAPA 3 · REVISÃO</div>
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-1">Revisar flashcards</h1>
      <p className="text-ink-400 mb-2">
        {generationMeta.returnedCount === generationMeta.requestedCount
          ? `${generationMeta.returnedCount} flashcards foram gerados`
          : `${generationMeta.returnedCount} de ${generationMeta.requestedCount} flashcards puderam ser gerados com qualidade`} a partir de <strong className="font-medium text-ink-600 dark:text-ink-200">{generationMeta.documentName}</strong>.
      </p>
      <p className="source-tab mb-6">{generationMeta.provider.toUpperCase()} · {generationMeta.model}</p>

      <div className="rounded-card border border-amber-300/70 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 mb-6">
        <div className="source-tab text-amber-800 dark:text-amber-300">REVISÃO ANTES DE SALVAR</div>
        <p className="text-sm text-amber-900/80 dark:text-amber-100/80 mt-1">
          Clique em <strong>Mostrar resposta</strong> para conferir cada card. Em cards Cloze, as marcações técnicas são escondidas e aparecem como lacunas. A fonte só é exibida depois da resposta para não entregar o conteúdo antes da hora.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {generatedCards.map((card, index) => (
          <ReviewCard key={card.id} card={card} index={index} />
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Link
          to="/create/configure"
          className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-center text-ink-700 dark:text-paper"
        >
          Gerar novamente
        </Link>
        <button
          type="button"
          disabled
          className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium opacity-40 cursor-not-allowed"
        >
          Revisar e salvar · próxima fase
        </button>
      </div>
    </div>
  );
}

function ReviewCard({ card, index }: { card: Flashcard; index: number }) {
  const [revealed, setRevealed] = useState(false);
  const source = card.sources[0];

  return (
    <article className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="source-tab text-clinical-600 dark:text-clinical-300">
          CARD {index + 1} · {TYPE_LABELS[card.type]}
        </div>
        <div className="text-xs text-ink-400">{DIFFICULTY_LABELS[card.difficulty]}</div>
      </div>

      <div className="source-tab mt-3">{card.topic}</div>
      <p className="font-medium mt-2 text-ink-900 dark:text-paper leading-6">
        <ClozeText text={card.question} revealed={revealed} />
      </p>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-5 w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
        >
          Mostrar resposta
        </button>
      ) : (
        <>
          <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800">
            <div className="source-tab">RESPOSTA</div>
            <p className="text-ink-600 dark:text-ink-100 mt-1 leading-6">{card.answer}</p>
          </div>

          {card.explanation && (
            <div className="mt-3">
              <div className="source-tab">EXPLICAÇÃO</div>
              <p className="text-sm text-ink-400 mt-1 leading-5">{card.explanation}</p>
            </div>
          )}

          {source && (
            <div className="mt-4 rounded-lg bg-paper dark:bg-ink-950/50 border border-ink-100 dark:border-ink-800 px-3.5 py-3">
              <div className="source-tab text-clinical-600 dark:text-clinical-300">
                FONTE · {source.title}{source.page ? ` · P. ${source.page}` : ""}
              </div>
              {source.excerpt && (
                <p className="font-mono text-xs leading-5 text-ink-400 mt-2">“{source.excerpt}”</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setRevealed(false)}
            className="mt-4 text-sm font-medium text-clinical-700 dark:text-clinical-300 hover:underline underline-offset-4"
          >
            Ocultar resposta
          </button>
        </>
      )}
    </article>
  );
}
