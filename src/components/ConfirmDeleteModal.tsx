interface ConfirmDeleteModalProps {
  open: boolean;
  deckTitle: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function ConfirmDeleteModal({
  open,
  deckTitle,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Cancelar exclusão"
        className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
        onClick={busy ? undefined : onCancel}
      />

      <div className="relative w-full max-w-md rounded-card border border-ink-200/70 dark:border-ink-800 bg-paper dark:bg-ink-900 shadow-cardHover p-6">
        <div className="source-tab text-signal-600 dark:text-signal-400">EXCLUIR DECK</div>
        <h2 className="font-display text-2xl text-ink-900 dark:text-paper mt-1">Excluir “{deckTitle}”?</h2>
        <p className="text-sm text-ink-400 mt-3">
          Esta ação remove o deck e também os cards, documentos, revisões e sessões de estudo vinculados a ele.
        </p>

        {error && <p className="text-sm text-signal-600 dark:text-signal-400 mt-4">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className="rounded-lg bg-signal-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-signal-400 transition-colors disabled:opacity-50"
          >
            {busy ? "Excluindo…" : "Excluir deck"}
          </button>
        </div>
      </div>
    </div>
  );
}
