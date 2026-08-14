import DeckCard from "../components/DeckCard";
import SearchInput from "../components/SearchInput";
import EmptyState from "../components/EmptyState";
import { mockDecks } from "../lib/mockData";

// TODO (Fase 3+): pesquisar/filtrar/ordenar de verdade contra o Realtime Database.
export default function Library() {
  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl text-ink-900 dark:text-paper">Biblioteca</h1>
        <div className="w-64">
          <SearchInput placeholder="Buscar decks…" />
        </div>
      </div>

      {mockDecks.length === 0 ? (
        <EmptyState
          title="Nenhum deck ainda"
          description="Envie um PDF ou DOCX para gerar seu primeiro deck com IA."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockDecks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}
    </div>
  );
}
