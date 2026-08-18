import { useEffect, useState, type FormEvent } from "react";
import type { Deck } from "../types";

interface DeckFormValues {
  title: string;
  specialty: string;
  topic: string;
}

interface DeckFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  deck?: Deck;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: DeckFormValues) => Promise<void> | void;
}

const emptyValues: DeckFormValues = {
  title: "",
  specialty: "",
  topic: "",
};

export default function DeckFormModal({
  open,
  mode,
  deck,
  busy = false,
  error,
  onClose,
  onSubmit,
}: DeckFormModalProps) {
  const [values, setValues] = useState<DeckFormValues>(emptyValues);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && deck) {
      setValues({
        title: deck.title,
        specialty: deck.specialty,
        topic: deck.topic ?? "",
      });
    } else {
      setValues(emptyValues);
    }
  }, [deck, mode, open]);

  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.title.trim() || !values.specialty.trim() || busy) return;
    await onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
        onClick={busy ? undefined : onClose}
      />

      <div className="relative w-full max-w-lg rounded-card border border-ink-200/70 dark:border-ink-800 bg-paper dark:bg-ink-900 shadow-cardHover p-6 sm:p-7">
        <div className="mb-6">
          <div className="source-tab text-clinical-600 dark:text-clinical-300">
            {mode === "create" ? "NOVO DECK" : "EDITAR DECK"}
          </div>
          <h2 className="font-display text-2xl text-ink-900 dark:text-paper mt-1">
            {mode === "create" ? "Organize um novo assunto" : "Ajuste as informações do deck"}
          </h2>
          <p className="text-sm text-ink-400 mt-2">
            O deck é a pasta onde seus flashcards ficarão organizados. Os cards serão adicionados nas próximas etapas.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Nome do deck"
            placeholder="Ex.: Insuficiência Cardíaca"
            value={values.title}
            onChange={(value) => setValues((current) => ({ ...current, title: value }))}
            autoFocus
          />
          <Field
            label="Especialidade"
            placeholder="Ex.: Cardiologia"
            value={values.specialty}
            onChange={(value) => setValues((current) => ({ ...current, specialty: value }))}
          />
          <Field
            label="Tema específico (opcional)"
            placeholder="Ex.: ICFEr"
            value={values.topic}
            onChange={(value) => setValues((current) => ({ ...current, topic: value }))}
          />

          {error && (
            <div className="rounded-lg border border-signal-400/40 bg-signal-400/10 px-3.5 py-3 text-sm text-signal-600 dark:text-signal-400">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !values.title.trim() || !values.specialty.trim()}
              className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Salvando…" : mode === "create" ? "Criar deck" : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}

function Field({ label, placeholder, value, autoFocus, onChange }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-700 dark:text-paper mb-1.5">{label}</span>
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ink-200 dark:border-ink-800 bg-paper-dim/50 dark:bg-ink-950 px-3.5 py-2.5 text-sm text-ink-900 dark:text-paper placeholder:text-ink-400 focus:bg-white dark:focus:bg-ink-950 transition-colors"
      />
    </label>
  );
}
