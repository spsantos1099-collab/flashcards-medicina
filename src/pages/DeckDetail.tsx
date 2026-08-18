import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import CardEditorModal, { type CardEditorValues } from "../components/CardEditorModal";
import ConfirmCardDeleteModal from "../components/ConfirmCardDeleteModal";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import DeckFormModal from "../components/DeckFormModal";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../contexts/AuthContext";
import { useDecks } from "../hooks/useDecks";
import { useCards } from "../hooks/useCards";
import { deleteCards, deleteDeck, setCardFavorite, updateCardData, updateDeckData } from "../lib/database";
import type { Flashcard } from "../types";

export default function DeckDetail() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { decks, loading } = useDecks(user?.uid);
  const deck = decks.find((item) => item.id === deckId);
  const { cards, loading: cardsLoading, error: cardsError } = useCards(user?.uid, deckId);
  const savedCount = Number(searchParams.get("saved") || 0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(() => new Set());
  const [cardDeleteOpen, setCardDeleteOpen] = useState(false);
  const [cardDeleteBusy, setCardDeleteBusy] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [editingBusy, setEditingBusy] = useState(false);

  const allSelected = cards.length > 0 && selectedCardIds.size === cards.length;
  const selectedCount = selectedCardIds.size;

  useEffect(() => {
    setSelectedCardIds((current) => {
      const validIds = new Set(cards.map((card) => card.id));
      const next = new Set(Array.from(current).filter((cardId) => validIds.has(cardId)));
      return next.size === current.size ? current : next;
    });
  }, [cards]);

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

  const handleToggleFavorite = async (cardId: string, nextValue: boolean) => {
    if (!user) return;
    setFavoriteBusyId(cardId);
    setActionError(null);
    try {
      await setCardFavorite(user.uid, cardId, nextValue);
    } catch (error) {
      console.error("Não foi possível atualizar o favorito.", error);
      setActionError("Não foi possível atualizar este favorito agora.");
    } finally {
      setFavoriteBusyId(null);
    }
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedCardIds(allSelected ? new Set() : new Set(cards.map((card) => card.id)));
  };

  const leaveManageMode = () => {
    setManageMode(false);
    setSelectedCardIds(new Set());
    setCardDeleteOpen(false);
  };

  const handleDeleteCards = async () => {
    if (!user || selectedCount === 0) return;
    setCardDeleteBusy(true);
    setActionError(null);
    try {
      await deleteCards(user.uid, deck.id, Array.from(selectedCardIds));
      leaveManageMode();
    } catch (error) {
      console.error("Não foi possível excluir os cards selecionados.", error);
      setActionError("Não foi possível excluir os cards selecionados. Tente novamente.");
    } finally {
      setCardDeleteBusy(false);
    }
  };

  const handleEditCard = async (values: CardEditorValues) => {
    if (!user || !editingCard) return;
    setEditingBusy(true);
    setActionError(null);
    try {
      await updateCardData(user.uid, editingCard.id, {
        type: values.type,
        difficulty: values.difficulty,
        topic: values.topic.trim() || deck.topic || deck.title,
        question: values.question,
        answer: values.answer,
        explanation: values.explanation,
        tags: values.tags.split(/[,;]+/).map((tag) => tag.trim()).filter(Boolean).slice(0, 6),
      });
      setEditingCard(null);
    } catch (error) {
      console.error("Não foi possível editar o card.", error);
      setActionError("Não foi possível salvar este card. Tente novamente.");
    } finally {
      setEditingBusy(false);
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

      {savedCount > 0 && (
        <div className="mt-5 rounded-lg border border-clinical-300 dark:border-clinical-800 bg-clinical-50/70 dark:bg-clinical-900/15 px-4 py-3 text-sm text-clinical-800 dark:text-clinical-100">
          {savedCount} {savedCount === 1 ? "flashcard foi salvo" : "flashcards foram salvos"} neste deck.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mt-7 rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card">
        <Stat label="Para revisar" value={deck.dueToday} />
        <Stat label="Novos" value={deck.newCards} />
        <Stat label="Aprendidos" value={deck.learnedCards} />
      </div>

      {actionError && !editOpen && !deleteOpen && !cardDeleteOpen && !editingCard && (
        <div className="mt-5 rounded-lg border border-signal-300/60 bg-signal-50/70 dark:border-signal-800 dark:bg-signal-950/20 px-4 py-3 text-sm text-signal-700 dark:text-signal-300">
          {actionError}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-8">
        <Link
          to={`/study/${deck.id}`}
          className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
        >
          Estudar agora
        </Link>
        {cards.some((card) => card.isFavorite) && (
          <Link
            to={`/study/${deck.id}?scope=favorites`}
            className="rounded-lg border border-clinical-300 dark:border-clinical-700 px-4 py-2.5 text-sm font-medium text-clinical-700 dark:text-clinical-200 hover:bg-clinical-50 dark:hover:bg-clinical-900/20 transition-colors"
          >
            Estudar favoritos
          </Link>
        )}
        <Link
          to={`/create/upload?deckId=${deck.id}`}
          className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
        >
          Gerar cards com IA
        </Link>
        {cards.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (manageMode) leaveManageMode();
              else {
                setManageMode(true);
                setActionError(null);
              }
            }}
            className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${manageMode ? "border-clinical-400 bg-clinical-50 text-clinical-700 dark:border-clinical-700 dark:bg-clinical-900/20 dark:text-clinical-200" : "border-ink-200 dark:border-ink-700 text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800"}`}
          >
            {manageMode ? "Fechar gerenciamento" : "Gerenciar cards"}
          </button>
        )}
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
          Excluir deck
        </button>
      </div>

      {deck.totalCards === 0 ? (
        <div className="mt-10 rounded-card border border-dashed border-ink-200 dark:border-ink-800 px-6 py-8">
          <div className="source-tab">DECK VAZIO</div>
          <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">Pronto para receber conteúdo</h2>
          <p className="text-sm text-ink-400 mt-2 max-w-xl">
            Gere flashcards a partir de um PDF/DOCX, use o Modo Prova ou adicione conteúdo pela tela de revisão.
          </p>
        </div>
      ) : (
        <section className="mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <div className="source-tab text-clinical-600 dark:text-clinical-300">CARDS DO DECK</div>
              <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">Conteúdo salvo</h2>
            </div>
            {manageMode && (
              <label className="inline-flex items-center gap-2 text-sm text-ink-600 dark:text-ink-200">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-ink-300 text-clinical-600 focus:ring-clinical-500"
                />
                Selecionar todos
              </label>
            )}
          </div>

          {manageMode && (
            <div className="mt-4 rounded-card border border-clinical-300 dark:border-clinical-800 bg-clinical-50/60 dark:bg-clinical-900/10 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="source-tab text-clinical-700 dark:text-clinical-200">GERENCIAMENTO ATIVO</div>
                <p className="text-sm text-ink-500 dark:text-ink-200 mt-1">
                  {selectedCount === 0 ? "Selecione os cards que deseja excluir." : `${selectedCount} ${selectedCount === 1 ? "card selecionado" : "cards selecionados"}.`}
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedCardIds(new Set())}
                  disabled={selectedCount === 0}
                  className="rounded-lg border border-ink-200 dark:border-ink-700 px-3.5 py-2 text-sm font-medium text-ink-600 dark:text-ink-200 disabled:opacity-40"
                >
                  Limpar seleção
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setCardDeleteOpen(true);
                  }}
                  disabled={selectedCount === 0}
                  className="rounded-lg bg-signal-600 text-white px-3.5 py-2 text-sm font-medium disabled:opacity-40"
                >
                  Excluir selecionados
                </button>
              </div>
            </div>
          )}

          {cardsLoading ? (
            <p className="text-sm text-ink-400 mt-3">Carregando cards…</p>
          ) : cardsError ? (
            <p className="text-sm text-signal-600 dark:text-signal-400 mt-3">{cardsError}</p>
          ) : (
            <div className="mt-4 space-y-3">
              {cards.map((card, index) => {
                const selected = selectedCardIds.has(card.id);
                return (
                  <div
                    key={card.id}
                    className={`rounded-lg border bg-white dark:bg-ink-900 px-4 py-3.5 transition-colors ${selected ? "border-clinical-400 dark:border-clinical-700 bg-clinical-50/40 dark:bg-clinical-900/10" : "border-ink-200/70 dark:border-ink-800"}`}
                  >
                    <div className="flex items-start gap-3">
                      {manageMode && (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCardSelection(card.id)}
                          aria-label={`Selecionar card ${index + 1}`}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-clinical-600 focus:ring-clinical-500"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="source-tab text-clinical-600 dark:text-clinical-300">{index + 1} · {card.type === "basic" ? "BÁSICO" : card.type === "cloze" ? "CLOZE" : "CASO CLÍNICO"}</div>
                          <div className="flex items-center gap-3 shrink-0">
                            {!manageMode && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setEditingCard(card);
                                }}
                                className="text-xs font-medium text-ink-500 hover:text-clinical-700 dark:text-ink-300 dark:hover:text-clinical-200"
                              >
                                Editar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleToggleFavorite(card.id, !card.isFavorite)}
                              disabled={favoriteBusyId === card.id || manageMode}
                              aria-label={card.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                              title={card.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                              className={`text-xl leading-none ${card.isFavorite ? "text-clinical-600 dark:text-clinical-300" : "text-ink-300 dark:text-ink-600"} disabled:opacity-50`}
                            >
                              {card.isFavorite ? "★" : "☆"}
                            </button>
                            <div className="text-xs text-ink-400">{card.difficulty === "easy" ? "Fácil" : card.difficulty === "hard" ? "Difícil" : "Média"}</div>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-ink-800 dark:text-paper mt-2 leading-5">{card.question.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, "$1")}</p>
                        <div className="source-tab mt-2">{card.topic}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
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

      <ConfirmCardDeleteModal
        open={cardDeleteOpen}
        count={selectedCount}
        busy={cardDeleteBusy}
        error={actionError}
        onCancel={() => setCardDeleteOpen(false)}
        onConfirm={handleDeleteCards}
      />

      <CardEditorModal
        open={Boolean(editingCard)}
        mode="edit"
        card={editingCard}
        defaultTopic={deck.topic || deck.title}
        onClose={() => setEditingCard(null)}
        onSubmit={(values) => void handleEditCard(values)}
      />

      {editingBusy && (
        <div className="fixed inset-x-0 bottom-5 z-[60] mx-auto w-fit rounded-full bg-ink-900 px-4 py-2 text-sm text-paper shadow-cardHover">
          Salvando card…
        </div>
      )}

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
