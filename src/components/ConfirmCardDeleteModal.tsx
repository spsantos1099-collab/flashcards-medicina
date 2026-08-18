interface ConfirmCardDeleteModalProps {
  open: boolean;
  count: number;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmCardDeleteModal({
  open,
  count,
  busy,
  error,
  onCancel,
  onConfirm,
}: ConfirmCardDeleteModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-5">
      <button
        type="button"
        aria-label="Fechar confirmação"
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]"
        onClick={busy ? undefined : onCancel}
      />
      <div className="relative w-full max-w-md rounded-card border border-ink-200/70 dark:border-ink-800 bg-paper dark:bg-ink-900 shadow-cardHover p-5 sm:p-6">
        <div className="source-tab text-signal-600 dark:text-signal-400">EXCLUIR CARDS</div>
        <h2 className="font-display text-2xl text-ink-900 dark:text-paper mt-1">
          Excluir {count} {count === 1 ? "card" : "cards"}?
        </h2>
        <p className="text-sm text-ink-400 mt-3 leading-6">
          Os cards selecionados e o histórico de revisão associado a eles serão removidos. Esta ação não pode ser desfeita.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-signal-400/30 bg-signal-400/10 px-3.5 py-3 text-sm text-signal-600 dark:text-signal-400">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || count === 0}
            className="rounded-lg bg-signal-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-signal-700 disabled:opacity-40"
          >
            {busy ? "Excluindo…" : `Excluir ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}
