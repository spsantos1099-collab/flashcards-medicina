import { useMemo, useState } from "react";
import DeckCard from "../components/DeckCard";
import DeckFormModal from "../components/DeckFormModal";
import EmptyState from "../components/EmptyState";
import SearchInput from "../components/SearchInput";
import { useAuth } from "../contexts/AuthContext";
import { useDecks } from "../hooks/useDecks";
import { createDeck } from "../lib/database";

export default function Library() {
  const { user } = useAuth();
  const { decks, loading, error } = useDecks(user?.uid);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const filteredDecks = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return decks;

    return decks.filter((deck) =>
      [deck.title, deck.specialty, deck.topic]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [decks, search]);

  const handleCreate = async (values: { title: string; specialty: string; topic: string }) => {
    if (!user) return;

    setSaving(true);
    setSaveError(null);
    try {
      await createDeck(user.uid, values);
      setCreateOpen(false);
    } catch (createError) {
      console.error("Não foi possível criar o deck.", createError);
      setSaveError("Não foi possível salvar o deck. Verifique sua conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setSaveError(null);
    setCreateOpen(true);
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="source-tab text-clinical-600 dark:text-clinical-300">SUA COLEÇÃO</div>
          <h1 className="font-display text-2xl text-ink-900 dark:text-paper mt-1">Biblioteca</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="w-full sm:w-64">
            <SearchInput placeholder="Buscar decks…" value={search} onChange={setSearch} />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors whitespace-nowrap"
          >
            + Novo deck
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-signal-400/40 bg-signal-400/10 px-4 py-3 text-sm text-signal-600 dark:text-signal-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Carregando decks">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-32 rounded-card border border-ink-200/70 dark:border-ink-800 bg-white/70 dark:bg-ink-900 animate-pulse"
            />
          ))}
        </div>
      ) : decks.length === 0 ? (
        <EmptyState
          title="Seu fichário começa aqui"
          description="Crie um deck para organizar um assunto. Depois, você poderá preenchê-lo a partir do seu material ou por pesquisa com fontes confiáveis."
          action={
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
            >
              Criar meu primeiro deck
            </button>
          }
        />
      ) : filteredDecks.length === 0 ? (
        <EmptyState
          title="Nenhum deck encontrado"
          description={`Não encontramos resultados para “${search.trim()}”.`}
        />
      ) : (
        <>
          <p className="text-sm text-ink-400 mb-4">
            {filteredDecks.length} {filteredDecks.length === 1 ? "deck" : "decks"}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDecks.map((deck) => (
              <DeckCard key={deck.id} deck={deck} />
            ))}
          </div>
        </>
      )}

      <DeckFormModal
        open={createOpen}
        mode="create"
        busy={saving}
        error={saveError}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
