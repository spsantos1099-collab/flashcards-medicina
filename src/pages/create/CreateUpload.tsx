import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCreateFlow } from "../../contexts/CreateFlowContext";
import { useDecks } from "../../hooks/useDecks";
import { createDocumentRecord, linkDocumentToDeck } from "../../lib/database";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ["pdf", "docx"];

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File) {
  const extension = extensionOf(file.name);

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return "Formato não aceito. Selecione um arquivo PDF ou DOCX.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "Este arquivo ultrapassa 25 MB. Escolha um documento menor.";
  }

  if (file.size === 0) {
    return "Este arquivo está vazio. Escolha outro documento.";
  }

  return null;
}

export default function CreateUpload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { decks, loading: decksLoading } = useDecks(user?.uid);
  const {
    file,
    targetDeckId,
    setFile,
    setTargetDeckId,
    setDocumentRecord,
  } = useCreateFlow();

  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const requestedDeckId = searchParams.get("deckId");
    if (!requestedDeckId || decksLoading) return;

    if (decks.some((deck) => deck.id === requestedDeckId)) {
      setTargetDeckId(requestedDeckId);
    }
  }, [decks, decksLoading, searchParams, setTargetDeckId]);

  useEffect(() => {
    if (!targetDeckId && decks.length === 1) {
      setTargetDeckId(decks[0].id);
    }
  }, [decks, setTargetDeckId, targetDeckId]);

  const acceptFile = (nextFile: File) => {
    const error = validateFile(nextFile);
    setSaveError(null);

    if (error) {
      setFileError(error);
      setFile(null);
      setDocumentRecord(null);
      return;
    }

    setFileError(null);
    setFile(nextFile);
    setDocumentRecord(null);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) acceptFile(selected);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const removeFile = () => {
    setFile(null);
    setFileError(null);
    setSaveError(null);
    setDocumentRecord(null);
  };

  const handleContinue = async () => {
    if (!user || !file || !targetDeckId) return;

    setSaving(true);
    setSaveError(null);

    try {
      const record = await createDocumentRecord(user.uid, targetDeckId, file);
      await linkDocumentToDeck(user.uid, targetDeckId, record);
      setDocumentRecord(record);
      navigate("/create/configure");
    } catch (error) {
      console.error("Não foi possível preparar o documento.", error);
      setSaveError("Não foi possível preparar este documento agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const selectedDeck = decks.find((deck) => deck.id === targetDeckId);
  const canContinue = Boolean(file && targetDeckId && !saving);

  return (
    <div className="max-w-2xl">
      <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">CRIAR COM IA · MEU MATERIAL</div>
      <h1 className="font-display text-3xl text-ink-900 dark:text-paper mb-1">
        Enviar material de estudo
      </h1>
      <p className="text-ink-400 mb-8 max-w-xl">
        Selecione um PDF ou DOCX. O arquivo será processado no seu navegador, sem Firebase Storage.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-7">
        <div className="rounded-card border border-clinical-500 bg-clinical-50/60 dark:bg-clinical-700/15 p-4">
          <div className="source-tab text-clinical-700 dark:text-clinical-200">ATIVO</div>
          <div className="font-display text-lg text-ink-900 dark:text-paper mt-1">Meu material</div>
          <p className="text-sm text-ink-400 mt-1">PDF ou DOCX com fonte rastreável por documento.</p>
        </div>
        <div className="rounded-card border border-ink-200 dark:border-ink-800 p-4 opacity-70">
          <div className="source-tab">PLANEJADO</div>
          <div className="font-display text-lg text-ink-900 dark:text-paper mt-1">Pesquisar por tema</div>
          <p className="text-sm text-ink-400 mt-1">Fontes médicas verificáveis, sem precisar enviar um arquivo.</p>
        </div>
      </div>

      <label htmlFor="target-deck" className="block text-sm font-medium text-ink-700 dark:text-ink-100 mb-2">
        Deck de destino
      </label>
      {decksLoading ? (
        <div className="h-11 rounded-lg border border-ink-200 dark:border-ink-800 animate-pulse mb-6" />
      ) : decks.length > 0 ? (
        <select
          id="target-deck"
          value={targetDeckId ?? ""}
          onChange={(event) => setTargetDeckId(event.target.value || null)}
          className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3.5 py-3 text-sm text-ink-900 dark:text-paper outline-none focus:border-clinical-500 mb-6"
        >
          <option value="">Selecione um deck</option>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.specialty} · {deck.title}
            </option>
          ))}
        </select>
      ) : (
        <div className="rounded-card border border-ink-200 dark:border-ink-800 p-4 mb-6">
          <p className="text-sm text-ink-500 dark:text-ink-200">Você precisa ter pelo menos um deck antes de enviar um material.</p>
          <Link to="/library" className="inline-block mt-2 text-sm font-medium text-clinical-600 dark:text-clinical-300">
            Ir para a Biblioteca e criar um deck →
          </Link>
        </div>
      )}

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={handleDrop}
        className={`rounded-card border-2 border-dashed transition-colors ${
          dragging
            ? "border-clinical-500 bg-clinical-50/60 dark:bg-clinical-700/15"
            : file
              ? "border-clinical-400 bg-white dark:bg-ink-900"
              : "border-ink-200 dark:border-ink-800"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleInputChange}
        />

        {file ? (
          <div className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="h-12 w-12 shrink-0 rounded-lg border border-ink-200 dark:border-ink-700 flex items-center justify-center font-mono text-xs text-clinical-700 dark:text-clinical-300">
                {extensionOf(file.name).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="source-tab text-clinical-600 dark:text-clinical-300">ARQUIVO SELECIONADO</div>
                <p className="font-medium text-ink-900 dark:text-paper mt-1 break-words">{file.name}</p>
                <p className="text-sm text-ink-400 mt-1">{formatBytes(file.size)} · {extensionOf(file.name).toUpperCase()}</p>
                {selectedDeck && (
                  <p className="text-sm text-ink-400 mt-1">Destino: {selectedDeck.title}</p>
                )}
              </div>
              <div className="flex gap-3 text-sm shrink-0">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="font-medium text-clinical-600 dark:text-clinical-300"
                >
                  Trocar
                </button>
                <button type="button" onClick={removeFile} className="text-signal-600 dark:text-signal-400">
                  Remover
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 px-5 py-14 text-center"
          >
            <span className="font-display text-xl text-ink-900 dark:text-paper">
              Arraste um arquivo ou clique para selecionar
            </span>
            <span className="text-sm text-ink-400">PDF ou DOCX · até 25 MB</span>
          </button>
        )}
      </div>

      {fileError && (
        <div className="mt-3 rounded-lg bg-signal-400/10 px-3.5 py-3 text-sm text-signal-600 dark:text-signal-400">
          {fileError}
        </div>
      )}

      <div className="mt-5 rounded-card border border-ink-200/70 dark:border-ink-800 px-4 py-3.5">
        <div className="source-tab">PRIVACIDADE DO ARQUIVO</div>
        <p className="text-sm text-ink-400 mt-1">
          O PDF/DOCX não é enviado para o Firebase nem fica armazenado na nuvem. Nesta fase, o banco salva apenas os metadados do documento para manter a rastreabilidade.
        </p>
      </div>

      {saveError && <p className="mt-4 text-sm text-signal-600 dark:text-signal-400">{saveError}</p>}

      <button
        type="button"
        disabled={!canContinue}
        onClick={handleContinue}
        className="mt-6 w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-3 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? "Preparando documento…" : "Continuar"}
      </button>
    </div>
  );
}
