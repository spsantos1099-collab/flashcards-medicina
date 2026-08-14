import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import DeckFormModal from "../components/DeckFormModal";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../contexts/AuthContext";
import { useDecks } from "../hooks/useDecks";
import { deleteDeck, updateDeckData } from "../lib/database";

export default function DeckDetail() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { decks, loading } = useDecks(user?.uid);
  const deck = decks.find((item) => item.id === deckId);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="h-6 w-28 rounded bg-ink-200/60 dark:bg-ink-800 animate-pulse" />
        <div className="h-10 w-64 rounded bg-ink-200/60 dark:bg-ink-800 animate-pulse mt-3" />
        <div className="h-24 rounded-card border border-ink-200/70 dark:border-ink-800 mt-8 animate-pulse" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="max-w-3xl">
        <EmptyState
          title="Deck não encontrado"
          description="Ele pode ter sido excluído ou não pertencer a esta conta."
          action={
            <Link to="/library" className="text-sm font-medium text-clinical-600 dark:text-clinical-300">
              Voltar para a Biblioteca
            </Link>
          }
        />
      </div>
    );
  }

  const handleEdit = async (values: { title: string; specialty: string; topic: string }) => {
    if (!user) return;

    setBusy(true);
    setActionError(null);
    try {
      await updateDeckData(user.uid, deck.id, values);
      setEditOpen(false);
    } catch (error) {
      console.error("Não foi possível editar o deck.", error);
      setActionError("Não foi possível salvar as alterações. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    setBusy(true);
    setActionError(null);
    try {
      await deleteDeck(user.uid, deck.id);
      navigate("/library", { replace: true });
    } catch (error) {
      console.error("Não foi possível excluir o deck.", error);
      setActionError("Não foi possível excluir o deck. Tente novamente.");
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <Link to="/library" className="text-sm text-ink-400 hover:text-clinical-600 transition-colors">
        ← Biblioteca
      </Link>

      <div className="mt-5 source-tab text-clinical-600 dark:text-clinical-300">{deck.specialty}</div>
      <h1 className="font-display text-3xl mt-1 text-ink-900 dark:text-paper">{deck.title}</h1>
      {deck.topic && <p className="text-ink-400 mt-1">{deck.topic}</p>}
      <p className="text-ink-400 mt-2">{deck.totalCards} cards</p>
      {deck.sourceDocumentName && (
        <p className="text-sm text-ink-400 mt-1">Origem: {deck.sourceDocumentName}</p>
      )}

      <div className="grid grid-cols-3 gap-4 mt-7 rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card">
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
        <Link
          to={`/create/upload?deckId=${deck.id}`}
          className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
        >
          Gerar cards com IA
        </Link>
        <button
          type="button"
          onClick={() => {
            setActionError(null);
            setEditOpen(true);
          }}
          className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
        >
          Editar deck
        </button>
        <button
          type="button"
          onClick={() => {
            setActionError(null);
            setDeleteOpen(true);
          }}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-signal-600 dark:text-signal-400 hover:bg-signal-400/10 transition-colors"
        >
          Excluir
        </button>
      </div>

      {deck.totalCards === 0 && (
        <div className="mt-10 rounded-card border border-dashed border-ink-200 dark:border-ink-800 px-6 py-8">
          <div className="source-tab">DECK VAZIO</div>
          <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">Pronto para receber conteúdo</h2>
          <p className="text-sm text-ink-400 mt-2 max-w-xl">
            Este deck já pode receber um PDF ou DOCX. O arquivo permanece no navegador e o Firebase guarda apenas os metadados necessários para rastrear a origem. A extração do conteúdo entra na próxima fase.
          </p>
        </div>
      )}

      <DeckFormModal
        open={editOpen}
        mode="edit"
        deck={deck}
        busy={busy}
        error={actionError}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
      />

      <ConfirmDeleteModal
        open={deleteOpen}
        deckTitle={deck.title}
        busy={busy}
        error={actionError}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-xl text-ink-900 dark:text-paper">{value}</div>
      <div className="text-ink-400 text-sm mt-0.5">{label}</div>
    </div>
  );
}
