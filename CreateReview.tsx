import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CardEditorModal, { type CardEditorValues } from "../../components/CardEditorModal";
import ClozeText from "../../components/ClozeText";
import { useAuth } from "../../contexts/AuthContext";
import { useCreateFlow } from "../../contexts/CreateFlowContext";
import { useDecks } from "../../hooks/useDecks";
import { saveCardsToDeck } from "../../lib/database";
import { AIGenerationError, generateFlashcardsFromDocument, type GenerationProgress } from "../../services/ai/generateFlashcards";
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

type ReviewStatus = "pending" | "approved" | "rejected";
interface ReviewItem { card: Flashcard; status: ReviewStatus }

function tempId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function progressLabel(progress: GenerationProgress | null) {
  if (!progress) return "Regenerando…";
  if (progress.stage === "validating") return "Revisando…";
  if (progress.stage === "retrying") return "Tentando novamente…";
  if (progress.stage === "refill") return "Buscando outra versão…";
  return progress.label || "Regenerando…";
}

export default function CreateReview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { decks } = useDecks(user?.uid);
  const {
    generatedCards,
    generationMeta,
    generationOptions,
    targetDeckId,
    extractedDocument,
    setGeneratedCards,
    reset,
  } = useCreateFlow();

  const deck = decks.find((item) => item.id === targetDeckId);
  const [items, setItems] = useState<ReviewItem[]>(() => generatedCards.map((card) => ({ card, status: "pending" })));
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenerationProgress, setRegenerationProgress] = useState<GenerationProgress | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const approvedCount = items.filter((item) => item.status === "approved").length;
  const rejectedCount = items.filter((item) => item.status === "rejected").length;
  const pendingCount = items.length - approvedCount - rejectedCount;
  const reviewBusy = Boolean(regeneratingId) || saving;

  useEffect(() => {
    setGeneratedCards(items.map((item) => item.card));
  }, [items, setGeneratedCards]);

  const updateItems = (updater: (current: ReviewItem[]) => ReviewItem[]) => {
    setItems(updater);
  };

  if (!generationMeta || !deck) {
    return (
      <div className="max-w-xl">
        <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">ETAPA 3 · REVISÃO</div>
        <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-2">Nenhuma geração nesta sessão</h1>
        <p className="text-ink-400 mb-6">
          Os cards gerados ficam somente na memória do navegador até serem aprovados e salvos. Volte à criação e gere novamente.
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

  const examMode = generationMeta.provider === "exam_parser";

  const setStatus = (cardId: string, status: ReviewStatus) => {
    updateItems((current) => current.map((item) => item.card.id === cardId ? { ...item, status } : item));
  };

  const removeCard = (cardId: string) => {
    updateItems((current) => current.filter((item) => item.card.id !== cardId));
    setActionError(null);
  };

  const handleEdit = (values: CardEditorValues) => {
    if (!editingCard) return;
    const now = new Date().toISOString();
    updateItems((current) => current.map((item) => item.card.id === editingCard.id
      ? {
          ...item,
          status: "pending",
          card: {
            ...item.card,
            type: values.type,
            difficulty: values.difficulty,
            topic: values.topic.trim() || deck.topic || deck.title,
            question: values.question.trim(),
            answer: values.answer.trim(),
            learningObjective: `user-reviewed:${values.question.trim().slice(0, 140)}`,
            explanation: values.explanation.trim() || undefined,
            tags: values.tags.split(/[,;]+/).map((tag) => tag.trim()).filter(Boolean).slice(0, 6),
            updatedAt: now,
          },
        }
      : item));
    setEditingCard(null);
  };

  const handleManual = (values: CardEditorValues) => {
    const now = new Date().toISOString();
    const card: Flashcard = {
      id: tempId("manual"),
      deckId: deck.id,
      type: values.type,
      difficulty: values.difficulty,
      topic: values.topic.trim() || deck.topic || deck.title,
      question: values.question.trim(),
      answer: values.answer.trim(),
      explanation: values.explanation.trim() || undefined,
      tags: values.tags.split(/[,;]+/).map((tag) => tag.trim()).filter(Boolean).slice(0, 6),
      learningObjective: `manual:${values.question.trim().slice(0, 120)}`,
      sources: [{
        id: tempId("source-manual"),
        kind: "manual",
        title: "Criado manualmente",
        provider: "Usuário",
        verificationStatus: "manual",
      }],
      createdAt: now,
      updatedAt: now,
    };
    updateItems((current) => [...current, { card, status: "pending" }]);
    setManualOpen(false);
  };

  const handleRegenerate = async (card: Flashcard) => {
    if (regeneratingId || saving) return;
    if (!user || !extractedDocument) {
      setActionError("Para regenerar este card, o documento precisa continuar aberto nesta sessão.");
      return;
    }

    setRegeneratingId(card.id);
    setRegenerationProgress(null);
    setActionError(null);

    try {
      const result = await generateFlashcardsFromDocument({
        user,
        deck,
        document: extractedDocument,
        options: {
          amountMode: generationOptions?.amountMode || "custom",
          cardCount: 1,
          cardTypes: [card.type],
          priorities: generationOptions?.priorities || [],
          excludedQuestions: items.map((item) => item.card.question),
          excludedObjectives: items.map((item) => item.card.learningObjective || "").filter(Boolean),
        },
        onProgress: setRegenerationProgress,
      });
      const replacement = result.cards[0];
      if (!replacement) throw new Error("no_replacement");
      updateItems((current) => current.map((item) => item.card.id === card.id
        ? { card: replacement, status: "pending" }
        : item));
      setRevealed((current) => ({ ...current, [card.id]: false, [replacement.id]: false }));
    } catch (error) {
      console.error("Não foi possível regenerar o card.", error);
      setActionError(error instanceof AIGenerationError
        ? error.message
        : "Não foi possível gerar uma nova versão deste card agora.");
    } finally {
      setRegeneratingId(null);
      setRegenerationProgress(null);
    }
  };

  const handleSave = async () => {
    if (!user || approvedCount === 0 || saving) return;
    const approvedCards = items.filter((item) => item.status === "approved").map((item) => item.card);
    setSaving(true);
    setActionError(null);
    try {
      const saved = await saveCardsToDeck(user.uid, deck.id, approvedCards);
      reset();
      navigate(`/decks/${deck.id}?saved=${saved}`, { replace: true });
    } catch (error) {
      console.error("Não foi possível salvar os cards.", error);
      setActionError("Não foi possível salvar os cards no deck. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">ETAPA 3 · REVISÃO</div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-1">Revisar flashcards</h1>
          <p className="text-ink-400">
            {items.length} cards em revisão · <strong className="font-medium text-ink-600 dark:text-ink-200">{generationMeta.documentName}</strong>
          </p>
          <p className="source-tab mt-2">{examMode ? "MODO PROVA · GABARITO DO PDF" : "MEU MATERIAL · GERAÇÃO AUTOMÁTICA"}</p>
        </div>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          disabled={reviewBusy}
          className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-white dark:hover:bg-ink-800 disabled:opacity-40"
        >
          + Adicionar manualmente
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-6 mb-4">
        <Summary value={approvedCount} label="Aprovados" tone="approved" />
        <Summary value={pendingCount} label="Pendentes" tone="pending" />
        <Summary value={rejectedCount} label="Rejeitados" tone="rejected" />
      </div>

      <div className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white/70 dark:bg-ink-900/60 px-4 py-3.5 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-ink-500 dark:text-ink-200">
          Confira conteúdo e fonte. Edite o que quiser e aprove somente os cards que devem entrar no deck.
        </p>
        <button
          type="button"
          onClick={() => updateItems((current) => current.map((item) => item.status === "pending" ? { ...item, status: "approved" } : item))}
          disabled={pendingCount === 0 || reviewBusy}
          className="shrink-0 rounded-lg border border-clinical-300 dark:border-clinical-700 bg-clinical-50 dark:bg-clinical-900/20 px-3.5 py-2 text-sm font-medium text-clinical-700 dark:text-clinical-200 disabled:opacity-40"
        >
          Aprovar todos
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg border border-signal-400/40 bg-signal-400/10 px-4 py-3 mb-5 text-sm text-signal-600 dark:text-signal-400">
          {actionError}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {items.map((item, index) => (
          <ReviewCard
            key={item.card.id}
            item={item}
            index={index}
            revealed={Boolean(revealed[item.card.id])}
            regenerating={regeneratingId === item.card.id}
            busy={reviewBusy}
            regenerationLabel={regeneratingId === item.card.id ? progressLabel(regenerationProgress) : null}
            onReveal={(value) => setRevealed((current) => ({ ...current, [item.card.id]: value }))}
            onApprove={() => setStatus(item.card.id, "approved")}
            onReject={() => setStatus(item.card.id, "rejected")}
            onEdit={() => setEditingCard(item.card)}
            onRegenerate={() => handleRegenerate(item.card)}
            allowRegenerate={!examMode}
            onDelete={() => removeCard(item.card.id)}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="rounded-card border border-dashed border-ink-200 dark:border-ink-800 px-6 py-10 text-center mt-4">
          <h2 className="font-display text-xl text-ink-900 dark:text-paper">Nenhum card na revisão</h2>
          <p className="text-sm text-ink-400 mt-2">Adicione um card manualmente ou gere novamente.</p>
        </div>
      )}

      <div className="mt-7 rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 sm:p-5 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="source-tab text-clinical-600 dark:text-clinical-300">PRONTO PARA SALVAR</div>
            <p className="text-sm text-ink-500 dark:text-ink-200 mt-1">
              {approvedCount === 0
                ? "Aprove pelo menos um card para continuar."
                : `${approvedCount} ${approvedCount === 1 ? "card aprovado será salvo" : "cards aprovados serão salvos"} em ${deck.title}.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Link
              to={examMode ? "/create/exam" : "/create/configure"}
              className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-center text-ink-700 dark:text-paper"
            >
              {examMode ? "Voltar à prova" : "Gerar novamente"}
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={approvedCount === 0 || reviewBusy}
              className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium disabled:opacity-40"
            >
              {saving ? "Salvando…" : `Salvar ${approvedCount} ${approvedCount === 1 ? "card" : "cards"}`}
            </button>
          </div>
        </div>
      </div>

      <CardEditorModal
        open={Boolean(editingCard)}
        mode="edit"
        card={editingCard}
        defaultTopic={deck.topic || deck.title}
        onClose={() => setEditingCard(null)}
        onSubmit={handleEdit}
      />
      <CardEditorModal
        open={manualOpen}
        mode="create"
        defaultTopic={deck.topic || deck.title}
        onClose={() => setManualOpen(false)}
        onSubmit={handleManual}
      />
    </div>
  );
}

function Summary({ value, label, tone }: { value: number; label: string; tone: ReviewStatus }) {
  const classes = tone === "approved"
    ? "border-clinical-200 bg-clinical-50/60 dark:border-clinical-800 dark:bg-clinical-900/10"
    : tone === "rejected"
      ? "border-signal-400/30 bg-signal-400/5 dark:bg-signal-400/10"
      : "border-ink-200 bg-white/60 dark:border-ink-800 dark:bg-ink-900";
  return (
    <div className={`rounded-lg border px-3 py-3 ${classes}`}>
      <div className="font-display text-xl text-ink-900 dark:text-paper">{value}</div>
      <div className="text-xs text-ink-400 mt-0.5">{label}</div>
    </div>
  );
}

function ReviewCard({
  item,
  index,
  revealed,
  regenerating,
  busy,
  regenerationLabel,
  onReveal,
  onApprove,
  onReject,
  onEdit,
  onRegenerate,
  allowRegenerate,
  onDelete,
}: {
  item: ReviewItem;
  index: number;
  revealed: boolean;
  regenerating: boolean;
  busy: boolean;
  regenerationLabel: string | null;
  onReveal: (value: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  allowRegenerate: boolean;
  onDelete: () => void;
}) {
  const { card, status } = item;
  const statusLabel = status === "approved" ? "APROVADO" : status === "rejected" ? "REJEITADO" : "PENDENTE";
  const statusClass = status === "approved"
    ? "text-clinical-700 border-clinical-300 bg-clinical-50 dark:text-clinical-200 dark:border-clinical-700 dark:bg-clinical-900/20"
    : status === "rejected"
      ? "text-signal-600 border-signal-400/30 bg-signal-400/10 dark:text-signal-400"
      : "text-ink-400 border-ink-200 bg-paper dark:border-ink-700 dark:bg-ink-950";

  return (
    <article className={`rounded-card border bg-white dark:bg-ink-900 p-4 sm:p-5 shadow-card transition-opacity ${status === "rejected" ? "border-signal-400/30 opacity-70" : status === "approved" ? "border-clinical-300 dark:border-clinical-800" : "border-ink-200/70 dark:border-ink-800"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="source-tab text-clinical-600 dark:text-clinical-300">CARD {index + 1} · {TYPE_LABELS[card.type]}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-400">{DIFFICULTY_LABELS[card.difficulty]}</span>
          <span className={`source-tab rounded-full border px-2 py-0.5 ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>

      <div className="source-tab mt-3">{card.topic}</div>
      <p className="font-medium mt-2 text-ink-900 dark:text-paper leading-6">
        <ClozeText text={card.question} revealed={revealed} />
      </p>

      {!revealed ? (
        <button
          type="button"
          onClick={() => onReveal(true)}
          className="mt-5 w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-2.5 text-sm font-medium"
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
          {card.sources.length > 0 && (
            <div className="mt-4 rounded-lg bg-paper dark:bg-ink-950/50 border border-ink-100 dark:border-ink-800 px-3.5 py-3">
              <div className="source-tab text-clinical-600 dark:text-clinical-300">
                {card.sources[0]?.kind === "manual" ? "ORIGEM" : card.sources.length === 1 ? "FONTE" : `EVIDÊNCIAS · ${card.sources.length}`}
              </div>
              <div className="mt-2 space-y-3">
                {card.sources.map((source, sourceIndex) => (
                  <div key={source.id} className={sourceIndex > 0 ? "pt-3 border-t border-ink-100 dark:border-ink-800" : ""}>
                    <div className="source-tab text-ink-500 dark:text-ink-300">
                      {card.sources.length > 1 ? `FONTE ${sourceIndex + 1} · ` : ""}{source.title}{source.page ? ` · P. ${source.page}` : ""}
                    </div>
                    {source.excerpt && <p className="font-mono text-xs leading-5 text-ink-400 mt-1.5">“{source.excerpt}”</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button type="button" onClick={() => onReveal(false)} className="mt-4 text-sm font-medium text-clinical-700 dark:text-clinical-300 hover:underline underline-offset-4">
            Ocultar resposta
          </button>
        </>
      )}

      <div className="mt-5 pt-4 border-t border-ink-100 dark:border-ink-800 flex flex-wrap gap-2">
        <button type="button" onClick={onApprove} disabled={busy} className="rounded-lg bg-clinical-600 text-white px-3 py-2 text-xs font-medium disabled:opacity-40">Aprovar</button>
        <button type="button" onClick={onReject} disabled={busy} className="rounded-lg border border-signal-400/40 text-signal-600 dark:text-signal-400 px-3 py-2 text-xs font-medium disabled:opacity-40">Rejeitar</button>
        <button type="button" onClick={onEdit} disabled={busy} className="rounded-lg border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-200 px-3 py-2 text-xs font-medium disabled:opacity-40">Editar</button>
        {allowRegenerate && (
          <button type="button" onClick={onRegenerate} disabled={busy} className="rounded-lg border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-200 px-3 py-2 text-xs font-medium disabled:opacity-40">
            {regenerating ? regenerationLabel || "Regenerando…" : "Regenerar este card"}
          </button>
        )}
        <button type="button" onClick={onDelete} disabled={busy} className="rounded-lg px-3 py-2 text-xs font-medium text-ink-400 hover:text-signal-600 disabled:opacity-40">Excluir</button>
      </div>
    </article>
  );
}
