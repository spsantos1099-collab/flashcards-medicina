import type { Flashcard, ReviewRating } from "../types";
import ClozeText from "./ClozeText";

interface StudyCardProps {
  card: Flashcard;
  revealed: boolean;
  onReveal: () => void;
  onRate: (rating: ReviewRating) => void;
  onToggleFavorite?: () => void;
  busy?: boolean;
  favoriteBusy?: boolean;
}

export default function StudyCard({
  card,
  revealed,
  onReveal,
  onRate,
  onToggleFavorite,
  busy = false,
  favoriteBusy = false,
}: StudyCardProps) {
  const hasSources = card.sources.length > 0;

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div className="source-tab text-clinical-600 dark:text-clinical-300">{card.topic}</div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleFavorite}
              disabled={!onToggleFavorite || favoriteBusy}
              aria-label={card.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              title={card.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              className={`text-xl leading-none transition-colors disabled:opacity-50 ${
                card.isFavorite
                  ? "text-clinical-600 dark:text-clinical-300"
                  : "text-ink-300 hover:text-clinical-600 dark:text-ink-600 dark:hover:text-clinical-300"
              }`}
            >
              {card.isFavorite ? "★" : "☆"}
            </button>
            <div className="text-[11px] text-ink-400">
              {card.type === "basic" ? "Básico" : card.type === "cloze" ? "Cloze" : "Caso clínico"} · {card.difficulty === "easy" ? "Fácil" : card.difficulty === "hard" ? "Difícil" : "Média"}
            </div>
          </div>
        </div>

        <div className="px-6 py-8 min-h-[10rem] flex items-center">
          <p className="font-display text-xl leading-relaxed text-ink-900 dark:text-paper">
            <ClozeText text={card.question} revealed={revealed} />
          </p>
        </div>

        {revealed && (
          <div className="px-6 pb-6 border-t border-ink-100 dark:border-ink-800 pt-5">
            <div className="source-tab text-ink-400">RESPOSTA</div>
            <p className="text-ink-800 dark:text-paper mt-1.5 leading-relaxed">{card.answer}</p>
            {card.explanation && (
              <>
                <div className="source-tab text-ink-400 mt-5">EXPLICAÇÃO</div>
                <p className="text-sm text-ink-500 mt-1.5 leading-relaxed">{card.explanation}</p>
              </>
            )}

            {hasSources && (
              <details className="mt-5 group">
                <summary className="cursor-pointer list-none source-tab text-ink-400 hover:text-clinical-600 dark:hover:text-clinical-300 underline underline-offset-4 decoration-dotted">
                  {card.sources.length === 1 ? "Ver fonte" : `Ver fontes (${card.sources.length})`}
                </summary>
                <div className="mt-3 space-y-3 text-xs text-ink-400 font-data">
                  {card.sources.map((source) => (
                    <div key={source.id} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3">
                      <div>
                        {source.provider ? `${source.provider} · ` : ""}
                        {source.title}
                        {source.page ? ` · p. ${source.page}` : ""}
                        {source.section ? ` · ${source.section}` : ""}
                      </div>
                      {source.excerpt && <p className="mt-2 leading-relaxed">“{source.excerpt}”</p>}
                    </div>
                  ))}
                  {card.hasSourceConflict && card.sourceConflictNote && (
                    <div className="text-signal-600">Fontes divergem · {card.sourceConflictNote}</div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="mt-5">
        {!revealed ? (
          <button
            type="button"
            onClick={onReveal}
            className="w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-3 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
          >
            Mostrar resposta <span className="text-ink-400 dark:text-clinical-100 ml-1">(espaço)</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <RatingButton label="Errei" shortcut="1" tone="signal" disabled={busy} onClick={() => onRate("again")} />
            <RatingButton label="Difícil" shortcut="2" tone="neutral" disabled={busy} onClick={() => onRate("hard")} />
            <RatingButton label="Bom" shortcut="3" tone="neutral" disabled={busy} onClick={() => onRate("good")} />
            <RatingButton label="Fácil" shortcut="4" tone="clinical" disabled={busy} onClick={() => onRate("easy")} />
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
  disabled,
  onClick,
}: {
  label: string;
  shortcut: string;
  tone: "signal" | "neutral" | "clinical";
  disabled: boolean;
  onClick: () => void;
}) {
  const toneClasses = {
    signal: "border-signal-600/40 text-signal-600 hover:bg-signal-600/10",
    neutral: "border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800",
    clinical: "border-clinical-500/40 text-clinical-600 dark:text-clinical-300 hover:bg-clinical-50 dark:hover:bg-clinical-700/20",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-wait ${toneClasses}`}
    >
      {label}
      <span className="block text-[10px] font-data opacity-60 mt-0.5">{shortcut}</span>
    </button>
  );
}
