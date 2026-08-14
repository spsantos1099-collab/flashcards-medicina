import { Link } from "react-router-dom";
import type { Deck } from "../types";

export default function DeckCard({ deck }: { deck: Deck }) {
  return (
    <Link
      to={`/decks/${deck.id}`}
      className="group block rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card hover:shadow-cardHover hover:-translate-y-0.5 transition-all"
    >
      <div className="source-tab text-clinical-600 dark:text-clinical-300">{deck.specialty}</div>
      <h3 className="font-display text-lg mt-1 text-ink-900 dark:text-paper">{deck.title}</h3>
      <div className="flex items-center gap-4 mt-4 text-sm">
        <span className="text-ink-500">{deck.totalCards} cards</span>
        {deck.dueToday > 0 && (
          <span className="text-clinical-600 dark:text-clinical-300 font-medium">
            {deck.dueToday} para revisar
          </span>
        )}
      </div>
    </Link>
  );
}
