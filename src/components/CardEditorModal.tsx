import { useEffect, useState, type FormEvent } from "react";
import type { CardType, Difficulty, Flashcard } from "../types";

export interface CardEditorValues {
  type: CardType;
  difficulty: Difficulty;
  topic: string;
  question: string;
  answer: string;
  explanation: string;
  tags: string;
}

interface CardEditorModalProps {
  open: boolean;
  mode: "edit" | "create";
  card?: Flashcard | null;
  defaultTopic?: string;
  onClose: () => void;
  onSubmit: (values: CardEditorValues) => void;
}

const emptyValues: CardEditorValues = {
  type: "basic",
  difficulty: "medium",
  topic: "",
  question: "",
  answer: "",
  explanation: "",
  tags: "",
};

export default function CardEditorModal({
  open,
  mode,
  card,
  defaultTopic = "",
  onClose,
  onSubmit,
}: CardEditorModalProps) {
  const [values, setValues] = useState<CardEditorValues>(emptyValues);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && card) {
      setValues({
        type: card.type,
        difficulty: card.difficulty,
        topic: card.topic || defaultTopic,
        question: card.question,
        answer: card.answer,
        explanation: card.explanation || "",
        tags: card.tags.join(", "),
      });
      return;
    }
    setValues({ ...emptyValues, topic: defaultTopic });
  }, [card, defaultTopic, mode, open]);

  if (!open) return null;

  const clozeValid = values.type !== "cloze" || /\{\{c\d+::.+?\}\}/.test(values.question);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.question.trim() || !values.answer.trim() || !clozeValid) return;
    onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-5">
      <button
        type="button"
        aria-label="Fechar editor"
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-card border border-ink-200/70 dark:border-ink-800 bg-paper dark:bg-ink-900 shadow-cardHover p-5 sm:p-7">
        <div className="mb-5">
          <div className="source-tab text-clinical-600 dark:text-clinical-300">
            {mode === "edit" ? "EDITAR FLASHCARD" : "NOVO FLASHCARD MANUAL"}
          </div>
          <h2 className="font-display text-2xl text-ink-900 dark:text-paper mt-1">
            {mode === "edit" ? "Edite o conteúdo do flashcard" : "Adicione um card ao conjunto"}
          </h2>
          <p className="text-sm text-ink-400 mt-2">
            A edição altera o conteúdo do card, mas preserva a fonte original e a rastreabilidade já salva.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Tipo"
              value={values.type}
              onChange={(value) => setValues((current) => ({ ...current, type: value as CardType }))}
              options={[
                ["basic", "Básico"],
                ["cloze", "Cloze"],
                ["clinical_case", "Caso clínico"],
              ]}
            />
            <SelectField
              label="Dificuldade"
              value={values.difficulty}
              onChange={(value) => setValues((current) => ({ ...current, difficulty: value as Difficulty }))}
              options={[
                ["easy", "Fácil"],
                ["medium", "Média"],
                ["hard", "Difícil"],
              ]}
            />
          </div>

          <TextField
            label="Assunto"
            value={values.topic}
            placeholder="Ex.: Tratamento da insuficiência cardíaca"
            onChange={(value) => setValues((current) => ({ ...current, topic: value }))}
          />

          <TextAreaField
            label="Enunciado"
            value={values.question}
            rows={4}
            placeholder="Digite a pergunta do flashcard"
            onChange={(value) => setValues((current) => ({ ...current, question: value }))}
          />

          {values.type === "cloze" && (
            <div className={`rounded-lg border px-3.5 py-3 text-xs ${clozeValid ? "border-clinical-200 dark:border-clinical-800 bg-clinical-50/60 dark:bg-clinical-900/10 text-ink-500 dark:text-ink-200" : "border-signal-400/40 bg-signal-400/10 text-signal-600 dark:text-signal-400"}`}>
              Em cards Cloze, marque o trecho oculto como <code className="font-mono">{"{{c1::texto}}"}</code>. Essa marcação não aparece durante o estudo.
            </div>
          )}

          <TextAreaField
            label="Resposta"
            value={values.answer}
            rows={3}
            placeholder="Resposta objetiva"
            onChange={(value) => setValues((current) => ({ ...current, answer: value }))}
          />

          <TextAreaField
            label="Explicação (opcional)"
            value={values.explanation}
            rows={3}
            placeholder="Explique por que a resposta está correta"
            onChange={(value) => setValues((current) => ({ ...current, explanation: value }))}
          />

          <TextField
            label="Tags (opcional)"
            value={values.tags}
            placeholder="Ex.: ICFEr, tratamento, prova"
            onChange={(value) => setValues((current) => ({ ...current, tags: value }))}
          />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!values.question.trim() || !values.answer.trim() || !clozeValid}
              className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors disabled:opacity-40"
            >
              {mode === "edit" ? "Salvar alterações" : "Adicionar card"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-700 dark:text-paper mb-1.5">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ink-200 dark:border-ink-800 bg-paper-dim/50 dark:bg-ink-950 px-3.5 py-2.5 text-sm text-ink-900 dark:text-paper placeholder:text-ink-400"
      />
    </label>
  );
}

function TextAreaField({ label, value, placeholder, rows, onChange }: { label: string; value: string; placeholder: string; rows: number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-700 dark:text-paper mb-1.5">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-ink-200 dark:border-ink-800 bg-paper-dim/50 dark:bg-ink-950 px-3.5 py-2.5 text-sm leading-6 text-ink-900 dark:text-paper placeholder:text-ink-400"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-700 dark:text-paper mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-ink-200 dark:border-ink-800 bg-paper dark:bg-ink-950 px-3.5 py-2.5 text-sm text-ink-900 dark:text-paper"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}
