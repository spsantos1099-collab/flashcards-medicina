import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../contexts/AuthContext";
import { useAllCards } from "../hooks/useAllCards";
import { useDecks } from "../hooks/useDecks";
import { useReviews } from "../hooks/useReviews";
import { useStudyStats } from "../hooks/useStudyStats";
import {
  dailyActivity,
  deckPerformance,
  difficultCardMetrics,
  percentage,
  ratingCounts,
  reviewsInPeriod,
  type AnalyticsPeriod,
} from "../lib/studyAnalytics";

const periodLabels: Record<AnalyticsPeriod, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  all: "Tudo",
};

const ratingLabels = {
  again: "Errei",
  hard: "Difícil",
  good: "Bom",
  easy: "Fácil",
} as const;

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default function Statistics() {
  const { user } = useAuth();
  const { reviews, loading: reviewsLoading } = useReviews(user?.uid);
  const { cards, loading: cardsLoading } = useAllCards(user?.uid);
  const { decks, totals, loading: decksLoading } = useDecks(user?.uid);
  const { streakDays, reviewsToday, uniqueCardsToday } = useStudyStats(user?.uid);
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");

  const periodReviews = useMemo(() => reviewsInPeriod(reviews, period), [period, reviews]);
  const counts = useMemo(() => ratingCounts(periodReviews), [periodReviews]);
  const uniqueCards = useMemo(() => new Set(periodReviews.map((review) => review.cardId)).size, [periodReviews]);
  const noErrorRate = percentage(periodReviews.length - counts.again, periodReviews.length);
  const secureRate = percentage(counts.good + counts.easy, periodReviews.length);
  const activity = useMemo(() => dailyActivity(reviews, 7), [reviews]);
  const maxActivity = Math.max(1, ...activity.map((point) => point.reviews));
  const byDeck = useMemo(() => deckPerformance(periodReviews, decks), [decks, periodReviews]);
  const difficult = useMemo(() => difficultCardMetrics(reviews, cards, decks).slice(0, 5), [cards, decks, reviews]);
  const loading = reviewsLoading || cardsLoading || decksLoading;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-7">
        <div>
          <div className="source-tab text-clinical-600 dark:text-clinical-300">DESEMPENHO REAL</div>
          <h1 className="font-display text-3xl text-ink-900 dark:text-paper mt-1">Seu desempenho</h1>
          <p className="text-sm text-ink-400 mt-2 max-w-2xl">
            Métricas calculadas exclusivamente a partir das suas revisões salvas. Nenhum número fictício é exibido.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-1 self-start sm:self-auto">
          {(Object.keys(periodLabels) as AnalyticsPeriod[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                period === option
                  ? "bg-ink-900 text-paper dark:bg-clinical-600"
                  : "text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper"
              }`}
            >
              {periodLabels[option]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-card border border-ink-100 dark:border-ink-800 bg-white/70 dark:bg-ink-900 animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          title="Ainda não há histórico de estudo"
          description="Faça sua primeira sessão de revisão. As estatísticas serão construídas automaticamente a partir das suas respostas reais."
          action={
            <Link to="/study" className="inline-flex rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium">
              Começar revisão
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label={`Revisões · ${periodLabels[period]}`} value={periodReviews.length} />
            <StatCard label="Cards únicos" value={uniqueCards} hint={`${totals.learnedCards} aprendidos no fichário`} />
            <StatCard label="Sem erro" value={formatPercent(noErrorRate)} hint="Difícil, Bom ou Fácil" />
            <StatCard label="Sequência" value={`${streakDays} ${streakDays === 1 ? "dia" : "dias"}`} />
          </div>

          <div className="mt-5 rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="source-tab">HOJE</div>
                <div className="font-display text-xl text-ink-900 dark:text-paper mt-1">
                  {reviewsToday} {reviewsToday === 1 ? "revisão" : "revisões"}
                </div>
              </div>
              <p className="text-sm text-ink-400">
                {uniqueCardsToday} {uniqueCardsToday === 1 ? "card único estudado" : "cards únicos estudados"} hoje.
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-8">
            <section className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card p-5 sm:p-6">
              <div className="source-tab text-clinical-600 dark:text-clinical-300">ÚLTIMOS 7 DIAS</div>
              <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">Atividade de revisão</h2>
              <div className="mt-6 grid grid-cols-7 gap-2 items-end h-44" aria-label="Revisões realizadas nos últimos sete dias">
                {activity.map((point) => (
                  <div key={point.key} className="h-full flex flex-col justify-end items-center gap-2 min-w-0">
                    <div className="text-[10px] text-ink-400 font-data">{point.reviews || ""}</div>
                    <div className="w-full max-w-10 h-28 flex items-end rounded-md bg-ink-50 dark:bg-ink-800 overflow-hidden">
                      <div
                        className="w-full bg-clinical-500/80 dark:bg-clinical-500 rounded-md transition-[height]"
                        style={{ height: `${Math.max(point.reviews ? 8 : 0, (point.reviews / maxActivity) * 100)}%` }}
                        title={`${point.reviews} revisões · ${point.uniqueCards} cards únicos`}
                      />
                    </div>
                    <div className="text-[10px] uppercase text-ink-400 truncate">{point.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card p-5 sm:p-6">
              <div className="source-tab text-clinical-600 dark:text-clinical-300">COMO VOCÊ RESPONDEU</div>
              <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">Distribuição das avaliações</h2>
              <div className="mt-6 space-y-4">
                {(Object.keys(ratingLabels) as Array<keyof typeof ratingLabels>).map((rating) => {
                  const value = counts[rating];
                  const width = periodReviews.length ? (value / periodReviews.length) * 100 : 0;
                  return (
                    <div key={rating}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-ink-600 dark:text-ink-200">{ratingLabels[rating]}</span>
                        <span className="font-data text-xs text-ink-400">{value} · {periodReviews.length ? Math.round(width) : 0}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-ink-50 dark:bg-ink-800 mt-2 overflow-hidden">
                        <div
                          className={rating === "again" ? "h-full rounded-full bg-signal-400" : rating === "hard" ? "h-full rounded-full bg-ink-400" : "h-full rounded-full bg-clinical-500"}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-5 border-t border-ink-100 dark:border-ink-800 flex items-center justify-between gap-4">
                <div>
                  <div className="source-tab">BOM + FÁCIL</div>
                  <div className="font-display text-2xl text-ink-900 dark:text-paper mt-1">{formatPercent(secureRate)}</div>
                </div>
                <p className="text-xs text-ink-400 max-w-xs text-right">
                  “Sem erro” conta qualquer resposta diferente de Errei. “Bom + Fácil” mostra somente respostas em que você se sentiu mais segura.
                </p>
              </div>
            </section>
          </div>

          <section className="mt-8">
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <div className="source-tab text-clinical-600 dark:text-clinical-300">POR DECK</div>
                <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">Onde você está estudando mais</h2>
              </div>
            </div>

            {byDeck.length === 0 ? (
              <div className="rounded-card border border-dashed border-ink-200 dark:border-ink-800 px-6 py-7 text-sm text-ink-400">
                Nenhuma revisão neste período.
              </div>
            ) : (
              <div className="grid gap-3">
                {byDeck.map((row) => (
                  <article key={row.deckId} className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="source-tab text-clinical-600 dark:text-clinical-300">{row.specialty}</div>
                        <Link to={`/decks/${row.deckId}`} className="font-display text-lg text-ink-900 dark:text-paper hover:text-clinical-600 dark:hover:text-clinical-300">
                          {row.deckTitle}
                        </Link>
                        <p className="text-xs text-ink-400 mt-1">Última revisão: {formatDateTime(row.lastReviewedAt)}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm shrink-0">
                        <div><div className="source-tab">Revisões</div><div className="font-display text-lg text-ink-900 dark:text-paper">{row.reviews}</div></div>
                        <div><div className="source-tab">Cards</div><div className="font-display text-lg text-ink-900 dark:text-paper">{row.uniqueCards}</div></div>
                        <div><div className="source-tab">Sem erro</div><div className="font-display text-lg text-ink-900 dark:text-paper">{formatPercent(row.noErrorRate)}</div></div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div>
                <div className="source-tab text-clinical-600 dark:text-clinical-300">PONTOS DE ATENÇÃO</div>
                <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">Cards com maior histórico de dificuldade</h2>
              </div>
              <Link to="/difficult" className="text-sm font-medium text-clinical-600 dark:text-clinical-300">Ver Cards difíceis →</Link>
            </div>

            {difficult.length === 0 ? (
              <div className="rounded-card border border-dashed border-ink-200 dark:border-ink-800 px-6 py-7 text-sm text-ink-400">
                Ainda não há dificuldade recorrente suficiente para destacar cards aqui.
              </div>
            ) : (
              <div className="grid gap-3">
                {difficult.map((item, index) => (
                  <article key={item.card.id} className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card">
                    <div className="flex gap-4">
                      <div className="font-data text-xs text-ink-300 pt-1">{String(index + 1).padStart(2, "0")}</div>
                      <div className="min-w-0 flex-1">
                        <div className="source-tab text-clinical-600 dark:text-clinical-300">{item.deck?.title || item.card.topic}</div>
                        <h3 className="font-display text-lg leading-snug text-ink-900 dark:text-paper mt-1 line-clamp-2">{item.card.question}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400 mt-3">
                          <span>{item.again} {item.again === 1 ? "erro" : "erros"}</span>
                          <span>{item.hard}× difícil</span>
                          <span>{item.reviews} revisões</span>
                          <span>Última: {item.latestRating ? ratingLabels[item.latestRating] : "—"}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <p className="mt-7 text-xs text-ink-400 max-w-3xl">
            Estas métricas mostram seu histórico de revisão no Fichário. Elas não representam nota de prova nem uma medida definitiva do seu conhecimento. As próximas revisões são ajustadas automaticamente conforme suas respostas.
          </p>
        </>
      )}
    </div>
  );
}
