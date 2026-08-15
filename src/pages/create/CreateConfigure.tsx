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

function number(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default function CreateConfigure() {
  const { user } = useAuth();
  const { decks } = useDecks(user?.uid);
  const { file, targetDeckId, documentRecord, extractedDocument } = useCreateFlow();
  const [amount, setAmount] = useState("balanced");
  const [types, setTypes] = useState<string[]>(["Básico", "Cloze"]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const deck = decks.find((item) => item.id === targetDeckId);

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  if (!file || !targetDeckId || !documentRecord || !extractedDocument) {
    return (
      <div className="max-w-xl">
        <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">CRIAR COM IA · MEU MATERIAL</div>
        <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-2">Selecione o material novamente</h1>
        <p className="text-ink-400 mb-6">
          Por privacidade, o Fichário mantém o arquivo e o texto extraído somente nesta sessão do navegador. Se a página foi atualizada, selecione o PDF/DOCX novamente.
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

  const sourceDetail = extractedDocument.extension === "pdf"
    ? `${number(extractedDocument.pageCount ?? 0)} páginas · ${number(extractedDocument.pagesWithText ?? 0)} com texto`
    : "Documento Word com texto extraível";

  return (
    <div className="max-w-xl">
      <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">ETAPA 2 · CONFIGURAÇÃO</div>
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-1">
        Configurar geração
      </h1>
      <p className="text-ink-400 mb-1 break-words">{file.name}</p>
      {deck && <p className="text-sm text-ink-400 mb-6">Deck: {deck.specialty} · {deck.title}</p>}

      <div className="rounded-card border border-clinical-300 dark:border-clinical-700/60 bg-clinical-50/60 dark:bg-clinical-700/10 px-4 py-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="source-tab text-clinical-700 dark:text-clinical-200">CONTEÚDO EXTRAÍDO ✓</div>
            <p className="font-medium text-ink-900 dark:text-paper mt-1">{sourceDetail}</p>
            <p className="text-sm text-ink-400 mt-1">
              {number(extractedDocument.wordCount)} palavras · {number(extractedDocument.characterCount)} caracteres
            </p>
          </div>
          <div className="rounded-full border border-clinical-300 dark:border-clinical-700 px-2.5 py-1 source-tab text-clinical-700 dark:text-clinical-200 shrink-0">
            LOCAL
          </div>
        </div>

        <p className="text-sm text-ink-500 dark:text-ink-200 mt-3">
          O texto está somente na memória desta sessão. O Firebase guarda as métricas acima, mas não guarda o conteúdo do documento.
        </p>
      </div>

      {extractedDocument.warnings.length > 0 && (
        <div className="rounded-card border border-amber-300/70 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 mb-4">
          <div className="source-tab text-amber-800 dark:text-amber-300">ATENÇÃO NA EXTRAÇÃO</div>
          {extractedDocument.warnings.map((warning) => (
            <p key={warning} className="text-sm text-amber-900/80 dark:text-amber-100/80 mt-1">{warning}</p>
          ))}
        </div>
      )}

      <div className="rounded-card border border-ink-200/70 dark:border-ink-800 mb-7 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPreview((current) => !current)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
        >
          <div>
            <div className="source-tab">CONFERIR LEITURA</div>
            <div className="text-sm font-medium text-ink-800 dark:text-paper mt-1">
              {showPreview ? "Ocultar amostra" : "Ver amostra do texto extraído"}
            </div>
          </div>
          <span className="text-ink-400">{showPreview ? "−" : "+"}</span>
        </button>
        {showPreview && (
          <div className="border-t border-ink-200/70 dark:border-ink-800 bg-white/70 dark:bg-ink-950/40 px-4 py-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-ink-500 dark:text-ink-200 max-h-72 overflow-y-auto">
              {extractedDocument.fullText.slice(0, 3500)}
              {extractedDocument.fullText.length > 3500 ? "\n\n[…]" : ""}
            </pre>
          </div>
        )}
      </div>

      <div className="rounded-card border border-ink-200/70 dark:border-ink-800 px-4 py-3.5 mb-7">
        <div className="source-tab text-clinical-600 dark:text-clinical-300">RASTREABILIDADE</div>
        <p className="text-sm text-ink-400 mt-1">
          {extractedDocument.extension === "pdf"
            ? "As páginas foram preservadas separadamente. Na geração, cada card poderá apontar para a página do PDF usada como fonte."
            : "O DOCX não possui paginação fixa confiável. Os cards citarão o documento e, quando possível, o trecho usado como fonte."}
        </p>
      </div>

      <h2 className="font-display text-lg text-ink-900 dark:text-paper mb-3">Quantidade</h2>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {AMOUNTS.map((opt) => (
          <button
            key={opt.id}
            type="button"
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
        {CARD_TYPES.map((type) => (
          <Chip key={type} label={type} active={types.includes(type)} onClick={() => toggle(types, setTypes, type)} />
        ))}
      </div>

      <h2 className="font-display text-lg text-ink-900 dark:text-paper mb-3">Priorizar</h2>
      <div className="flex flex-wrap gap-2 mb-8">
        {PRIORITIES.map((priority) => (
          <Chip
            key={priority}
            label={priority}
            active={priorities.includes(priority)}
            onClick={() => toggle(priorities, setPriorities, priority)}
          />
        ))}
      </div>

      <div className="rounded-card border border-dashed border-ink-200 dark:border-ink-800 px-4 py-4">
        <div className="source-tab text-clinical-600 dark:text-clinical-300">DOCUMENTO PRONTO PARA A IA</div>
        <p className="text-sm text-ink-400 mt-1">
          A leitura local já está funcionando. Na Fase 7, este conteúdo seguirá para uma Netlify Function segura, onde implementaremos a geração sem expor a chave da IA no navegador.
        </p>
      </div>

      <button
        type="button"
        disabled
        className="mt-6 w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-3 text-sm font-medium opacity-40 cursor-not-allowed"
      >
        Gerar flashcards · IA na próxima fase
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
      type="button"
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
