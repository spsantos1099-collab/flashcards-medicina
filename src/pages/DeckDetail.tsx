import { useParams, Link } from "react-router-dom";
import { mockDecks } from "../lib/mockData";

// TODO (Fase 4): carregar deck e lista de cards reais por :deckId no Realtime Database.
export default function DeckDetail() {
  const { deckId } = useParams();
  const deck = mockDecks.find((d) => d.id === deckId) ?? mockDecks[0];

  return (
    <div className="max-w-3xl">
      <div className="source-tab text-clinical-600 dark:text-clinical-300">{deck.specialty}</div>
      <h1 className="font-display text-3xl mt-1 text-ink-900 dark:text-paper">{deck.title}</h1>
      <p className="text-ink-400 mt-1">{deck.totalCards} cards</p>
      {deck.sourceDocumentName && (
        <p className="text-sm text-ink-400 mt-1">Origem: {deck.sourceDocumentName}</p>
      )}

      <div className="flex gap-6 mt-6 text-sm">
        <Stat label="Para revisar" value={deck.dueToday} />
        <Stat label="Novos" value={deck.newCards} />
        <Stat label="Aprendidos" value={deck.learnedCards} />
      </div>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link
          to={`/study/${deck.id}`}
          className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
        >
          Estudar agora
        </Link>
        <button className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors">
          Adicionar cards
        </button>
        <Link
          to="/create/upload"
          className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
        >
          Gerar mais com IA
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-xl text-ink-900 dark:text-paper">{value}</div>
      <div className="text-ink-400">{label}</div>
    </div>
  );
}
