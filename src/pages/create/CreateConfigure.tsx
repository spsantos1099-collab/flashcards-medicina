import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCreateFlow } from "../../contexts/CreateFlowContext";
import { useDecks } from "../../hooks/useDecks";

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

export default function CreateConfigure() {
  const { user } = useAuth();
  const { decks } = useDecks(user?.uid);
  const { file, targetDeckId, documentRecord } = useCreateFlow();
  const [amount, setAmount] = useState("balanced");
  const [types, setTypes] = useState<string[]>(["Básico", "Cloze"]);
  const [priorities, setPriorities] = useState<string[]>([]);

  const deck = decks.find((item) => item.id === targetDeckId);

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  if (!file || !targetDeckId || !documentRecord) {
    return (
      <div className="max-w-xl">
        <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">CRIAR COM IA · MEU MATERIAL</div>
        <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-2">Selecione o material novamente</h1>
        <p className="text-ink-400 mb-6">
          Por privacidade, o Fichário não mantém o arquivo na nuvem. Se esta página foi atualizada, o navegador perde o acesso ao PDF/DOCX e você precisa selecioná-lo novamente.
        </p>
        <Link
          to={targetDeckId ? `/create/upload?deckId=${targetDeckId}` : "/create/upload"}
          className="inline-flex rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium"
        >
          Voltar e selecionar arquivo
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">ETAPA 2 · CONFIGURAÇÃO</div>
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-1">
        Configurar geração
      </h1>
      <p className="text-ink-400 mb-1 break-words">{file.name}</p>
      {deck && <p className="text-sm text-ink-400 mb-6">Deck: {deck.specialty} · {deck.title}</p>}

      <div className="rounded-card border border-clinical-200 dark:border-clinical-700/50 bg-clinical-50/50 dark:bg-clinical-700/10 px-4 py-3 mb-7">
        <div className="source-tab text-clinical-700 dark:text-clinical-200">DOCUMENTO PREPARADO</div>
        <p className="text-sm text-ink-500 dark:text-ink-200 mt-1">
          Os metadados já foram registrados. Na Fase 6, esta etapa passará a extrair o texto do PDF/DOCX no próprio navegador antes de liberar a geração com IA.
        </p>
      </div>

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
      <div className="flex flex-wrap gap-2 mb-8">
        {PRIORITIES.map((p) => (
          <Chip
            key={p}
            label={p}
            active={priorities.includes(p)}
            onClick={() => toggle(priorities, setPriorities, p)}
          />
        ))}
      </div>

      <div className="rounded-card border border-dashed border-ink-200 dark:border-ink-800 px-4 py-4">
        <div className="source-tab">PRÓXIMA FASE</div>
        <p className="text-sm text-ink-400 mt-1">
          O botão de geração ficará disponível após implementarmos a extração local do conteúdo. Assim, nenhum flashcard fictício será apresentado como se tivesse vindo do seu arquivo.
        </p>
      </div>

      <button
        type="button"
        disabled
        className="mt-6 w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-3 text-sm font-medium opacity-40 cursor-not-allowed"
      >
        Gerar flashcards
      </button>

      <Link
        to={`/create/upload?deckId=${targetDeckId}`}
        className="block text-center mt-3 text-sm text-clinical-600 dark:text-clinical-300"
      >
        Trocar documento
      </Link>
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
