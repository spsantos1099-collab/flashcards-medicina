import { useState } from "react";
import { useNavigate } from "react-router-dom";

const AMOUNTS = [
  { id: "essential", label: "Essencial", description: "Somente conceitos de maior importância." },
  { id: "balanced", label: "Equilibrada", description: "Boa cobertura sem excesso de cards." },
  { id: "detailed", label: "Detalhada", description: "Cobertura extensa do documento." },
  { id: "custom", label: "Personalizada", description: "Você escolhe aproximadamente quantos cards." },
];

const CARD_TYPES = ["Básico", "Cloze", "Caso clínico"];
const PRIORITIES = [
  "Conceitos fundamentais",
  "Diagnóstico",
  "Tratamento",
  "Casos clínicos",
  "Valores e critérios",
  "Pegadinhas de prova",
];

// TODO (Fase 7/8): enviar essas escolhas para a Netlify Function
// /.netlify/functions/generate-flashcards junto do texto extraído do documento.
export default function CreateConfigure() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("balanced");
  const [types, setTypes] = useState<string[]>(["Básico", "Cloze"]);
  const [priorities, setPriorities] = useState<string[]>([]);

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-1">
        Configurar geração
      </h1>
      <p className="text-ink-400 mb-6">Cardiologia - Arritmias.pdf</p>

      <h2 className="font-display text-lg text-ink-900 dark:text-paper mb-3">Quantidade</h2>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {AMOUNTS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setAmount(opt.id)}
            className={`text-left rounded-lg border p-3.5 transition-colors ${
              amount === opt.id
                ? "border-clinical-500 bg-clinical-50 dark:bg-clinical-700/20"
                : "border-ink-200 dark:border-ink-800 hover:bg-ink-50 dark:hover:bg-ink-800/50"
            }`}
          >
            <div className="font-medium text-sm text-ink-900 dark:text-paper">{opt.label}</div>
            <div className="text-xs text-ink-400 mt-0.5">{opt.description}</div>
          </button>
        ))}
      </div>

      <h2 className="font-display text-lg text-ink-900 dark:text-paper mb-3">Tipos de card</h2>
      <div className="flex flex-wrap gap-2 mb-8">
        {CARD_TYPES.map((t) => (
          <Chip key={t} label={t} active={types.includes(t)} onClick={() => toggle(types, setTypes, t)} />
        ))}
      </div>

      <h2 className="font-display text-lg text-ink-900 dark:text-paper mb-3">Priorizar</h2>
      <div className="flex flex-wrap gap-2 mb-10">
        {PRIORITIES.map((p) => (
          <Chip
            key={p}
            label={p}
            active={priorities.includes(p)}
            onClick={() => toggle(priorities, setPriorities, p)}
          />
        ))}
      </div>

      <button
        onClick={() => navigate("/create/review")}
        className="w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-3 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
      >
        Gerar flashcards
      </button>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? "border-clinical-500 bg-clinical-50 text-clinical-700 dark:bg-clinical-700/20 dark:text-clinical-100"
          : "border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800/50"
      }`}
    >
      {label}
    </button>
  );
}
