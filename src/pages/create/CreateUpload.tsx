import { useNavigate } from "react-router-dom";

// TODO (Fase 5): ligar ao Firebase Storage (upload real) e ao pdfjs-dist/mammoth
// para extração de conteúdo (Fase 6).
export default function CreateUpload() {
  const navigate = useNavigate();

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl text-ink-900 dark:text-paper mb-1">
        Criar flashcards com IA
      </h1>
      <p className="text-ink-400 mb-6">Envie um PDF ou DOCX do seu material de estudo.</p>

      <label className="flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink-200 dark:border-ink-800 py-16 cursor-pointer hover:border-clinical-400 transition-colors">
        <input type="file" accept=".pdf,.docx" className="hidden" />
        <span className="font-display text-lg text-ink-900 dark:text-paper">
          Arraste um arquivo ou clique para selecionar
        </span>
        <span className="text-sm text-ink-400">PDF ou DOCX · até 25 MB</span>
      </label>

      <button
        onClick={() => navigate("/create/configure")}
        className="mt-6 w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-3 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
      >
        Continuar
      </button>
    </div>
  );
}
