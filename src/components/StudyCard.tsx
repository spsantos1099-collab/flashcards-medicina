import { useState } from "react";
import type { Flashcard } from "../types";

interface StudyCardProps {
  card: Flashcard;
}

// O card de estudo é a peça central da interface. A "aba" no topo, com
// especialidade/assunto, e o rodapé de fonte (rastreabilidade) em fonte
// monoespaçada são o elemento de assinatura do produto.
export default function StudyCard({ card }: StudyCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const hasSources = card.sources.length > 0;

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card overflow-hidden">
        <div className="source-tab px-6 pt-5 text-clinical-600 dark:text-clinical-300">
          {card.topic}
        </div>

        <div className="px-6 py-8 min-h-[9rem] flex items-center">
          <p className="font-display text-xl leading-relaxed text-ink-900 dark:text-paper">
            {card.question}
          </p>
        </div>

        {revealed && (
          <div className="px-6 pb-6 border-t border-ink-100 dark:border-ink-800 pt-5">
            <p className="text-ink-800 dark:text-paper">{card.answer}</p>
            {card.explanation && (
              <p className="text-sm text-ink-500 mt-3">{card.explanation}</p>
            )}

            {hasSources && (
              <button
                onClick={() => setShowSource((s) => !s)}
                className="mt-4 source-tab text-ink-400 hover:text-clinical-600 dark:hover:text-clinical-300 underline underline-offset-4 decoration-dotted"
              >
                {card.sources.length === 1 ? "Ver fonte" : `Ver fontes (${card.sources.length})`}
              </button>
            )}

            {showSource && hasSources && (
              <div className="mt-2 space-y-2 text-xs text-ink-400 font-data">
                {card.sources.map((source) => (
                  <div key={source.id}>
                    {source.provider ? `${source.provider} · ` : ""}
                    {source.title}
                    {source.page ? ` · p. ${source.page}` : ""}
                    {source.section ? ` · ${source.section}` : ""}
                  </div>
                ))}
                {card.hasSourceConflict && card.sourceConflictNote && (
                  <div className="text-signal-600">Fontes divergem · {card.sourceConflictNote}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5">
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-3 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
          >
            Mostrar resposta <span className="text-ink-400 dark:text-clinical-100 ml-1">(espaço)</span>
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            <RatingButton label="Errei" shortcut="1" tone="signal" />
            <RatingButton label="Difícil" shortcut="2" tone="neutral" />
            <RatingButton label="Bom" shortcut="3" tone="neutral" />
            <RatingButton label="Fácil" shortcut="4" tone="clinical" />
          </div>
        )}
      </div>
    </div>
  );
}

function RatingButton({
  label,
  shortcut,
  tone,
}: {
  label: string;
  shortcut: string;
  tone: "signal" | "neutral" | "clinical";
}) {
  const toneClasses = {
    signal: "border-signal-600/40 text-signal-600 hover:bg-signal-600/10",
    neutral: "border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800",
    clinical: "border-clinical-500/40 text-clinical-600 dark:text-clinical-300 hover:bg-clinical-50 dark:hover:bg-clinical-700/20",
  }[tone];

  return (
    <button className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${toneClasses}`}>
      {label}
      <span className="block text-[10px] font-data opacity-60 mt-0.5">{shortcut}</span>
    </button>
  );
}
