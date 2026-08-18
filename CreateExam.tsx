import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCreateFlow } from "../../contexts/CreateFlowContext";
import { useDecks } from "../../hooks/useDecks";
import {
  createDocumentRecord,
  linkDocumentToDeck,
  markDocumentExtractionProcessing,
  markDocumentExtractionReady,
} from "../../lib/database";
import { DocumentExtractionError, extractDocument } from "../../lib/documentExtraction";
import { examQuestionsToFlashcards, parseExamDocument, type ExamParseResult } from "../../lib/examParser";
import { ExamSimplificationError, simplifyExamQuestions } from "../../services/ai/simplifyExamQuestions";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateExamFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "O Modo Prova aceita apenas arquivos PDF.";
  if (file.size === 0) return "Este PDF está vazio. Escolha outro arquivo.";
  if (file.size > MAX_FILE_SIZE) return "Este PDF ultrapassa 25 MB. Escolha um arquivo menor.";
  return null;
}

function difficultyLabel(value: "easy" | "medium" | "hard") {
  if (value === "easy") return "Fácil";
  if (value === "hard") return "Difícil";
  return "Média";
}

export default function CreateExam() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { decks, loading: decksLoading } = useDecks(user?.uid);
  const {
    file,
    targetDeckId,
    documentRecord,
    setFile,
    setTargetDeckId,
    setDocumentRecord,
    setExtractedDocument,
    setGeneratedCards,
    setGenerationMeta,
    setGenerationOptions,
  } = useCreateFlow();

  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("Analisando prova...");
  const [analysis, setAnalysis] = useState<ExamParseResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [examFilter, setExamFilter] = useState("all");
  const [cardStyle, setCardStyle] = useState<"faithful" | "memorization">("faithful");
  const [creatingCards, setCreatingCards] = useState(false);
  const [createProgress, setCreateProgress] = useState<{ completed: number; total: number } | null>(null);

  useEffect(() => {
    const requestedDeckId = searchParams.get("deckId");
    if (!requestedDeckId || decksLoading) return;
    if (decks.some((deck) => deck.id === requestedDeckId)) setTargetDeckId(requestedDeckId);
  }, [decks, decksLoading, searchParams, setTargetDeckId]);

  useEffect(() => {
    if (!targetDeckId && decks.length === 1) setTargetDeckId(decks[0].id);
  }, [decks, setTargetDeckId, targetDeckId]);

  const resetAnalysis = () => {
    setAnalysis(null);
    setSelectedIds(new Set());
    setExamFilter("all");
    setCardStyle("faithful");
    setCreatingCards(false);
    setCreateProgress(null);
    setActionError(null);
    setDocumentRecord(null);
    setExtractedDocument(null);
    setGeneratedCards([]);
    setGenerationMeta(null);
    setGenerationOptions(null);
  };

  const acceptFile = (nextFile: File) => {
    const error = validateExamFile(nextFile);
    resetAnalysis();
    if (error) {
      setFileError(error);
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(nextFile);
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
    resetAnalysis();
  };

  const handleAnalyze = async () => {
    if (!user || !file || !targetDeckId || processing) return;
    setProcessing(true);
    setActionError(null);
    setProcessingLabel("Lendo páginas do PDF...");

    try {
      const preview = await extractDocument(file, "exam-preview");
      setProcessingLabel("Identificando questões, gabarito e duplicatas...");
      const parsed = parseExamDocument(preview);

      if (parsed.totalQuestions === 0) {
        throw new Error("Não encontrei questões no formato esperado neste PDF.");
      }
      if (parsed.usableQuestions.length === 0) {
        throw new Error("As questões encontradas não puderam ser usadas. Verifique se o PDF possui gabarito marcado como CORRETA.");
      }

      const record = await createDocumentRecord(user.uid, targetDeckId, file);
      const extracted = { ...preview, documentId: record.id };
      await markDocumentExtractionProcessing(user.uid, record.id);
      await markDocumentExtractionReady(user.uid, record.id, extracted);
      await linkDocumentToDeck(user.uid, targetDeckId, record, "exam");

      setDocumentRecord(record);
      setExtractedDocument(extracted);
      setAnalysis(parsed);
      setSelectedIds(new Set(parsed.usableQuestions.map((question) => question.id)));
    } catch (error) {
      console.error("Não foi possível analisar a prova.", error);
      const extractionError = error instanceof DocumentExtractionError ? error : null;
      setActionError(extractionError?.message ?? (error instanceof Error ? error.message : "Não foi possível analisar esta prova."));
    } finally {
      setProcessing(false);
      setProcessingLabel("Analisando prova...");
    }
  };

  const examIds = useMemo(() => {
    if (!analysis) return [];
    return Array.from(new Set(analysis.usableQuestions.map((question) => question.examId).filter(Boolean)));
  }, [analysis]);

  const visibleQuestions = useMemo(() => {
    if (!analysis) return [];
    if (examFilter === "all") return analysis.usableQuestions;
    return analysis.usableQuestions.filter((question) => question.examId === examFilter);
  }, [analysis, examFilter]);

  const selectedCount = selectedIds.size;
  const visibleAllSelected = visibleQuestions.length > 0 && visibleQuestions.every((question) => selectedIds.has(question.id));

  const toggleQuestion = (questionId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const toggleVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleQuestions.forEach((question) => {
        if (visibleAllSelected) next.delete(question.id);
        else next.add(question.id);
      });
      return next;
    });
  };

  const handleCreateCards = async () => {
    if (!user || !analysis || !targetDeckId || !documentRecord || selectedCount === 0 || creatingCards) return;
    const selectedQuestions = analysis.usableQuestions.filter((question) => selectedIds.has(question.id));
    setCreatingCards(true);
    setCreateProgress(null);
    setActionError(null);

    try {
      const simplified = cardStyle === "memorization"
        ? await simplifyExamQuestions({
            user,
            questions: selectedQuestions,
            onProgress: (completed, total) => setCreateProgress({ completed, total }),
          })
        : [];

      const cards = examQuestionsToFlashcards(
        selectedQuestions,
        targetDeckId,
        documentRecord.id,
        documentRecord.name,
        { style: cardStyle, simplified },
      );

      setGeneratedCards(cards);
      setGenerationOptions(null);
      setGenerationMeta({
        provider: "exam_parser",
        model: cardStyle === "memorization" ? "Memorização rápida · Gemini" : "Gabarito do PDF",
        requestedCount: selectedQuestions.length,
        returnedCount: cards.length,
        generatedAt: new Date().toISOString(),
        documentName: documentRecord.name,
      });
      navigate("/create/review");
    } catch (error) {
      console.error("Não foi possível criar os cards da prova.", error);
      setActionError(error instanceof ExamSimplificationError
        ? error.message
        : "Não foi possível criar os flashcards selecionados. Tente novamente.");
    } finally {
      setCreatingCards(false);
      setCreateProgress(null);
    }
  };

  const selectedDeck = decks.find((deck) => deck.id === targetDeckId);
  const canAnalyze = Boolean(file && targetDeckId && !processing);

  return (
    <div className="max-w-3xl">
      <div className="source-tab text-clinical-600 dark:text-clinical-300 mb-2">CRIAR · MODO PROVA</div>
      <h1 className="font-display text-3xl text-ink-900 dark:text-paper mb-1">Transformar prova em flashcards</h1>
      <p className="text-ink-400 mb-8 max-w-2xl">
        Envie um PDF de prova com gabarito. O Fichário usa a alternativa marcada como CORRETA, remove questões repetidas e descarta automaticamente questões que dependem de imagem, gráfico, traçado ou nomograma.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-7">
        <Link
          to={targetDeckId ? `/create/upload?deckId=${targetDeckId}` : "/create/upload"}
          className="rounded-card border border-ink-200 dark:border-ink-800 p-4 hover:border-clinical-300 transition-colors"
        >
          <div className="source-tab text-clinical-600 dark:text-clinical-300">MEU MATERIAL</div>
          <div className="font-display text-lg text-ink-900 dark:text-paper mt-1">PDF ou DOCX</div>
          <p className="text-sm text-ink-400 mt-1">Geração tradicional a partir do material de estudo.</p>
        </Link>
        <div className="rounded-card border border-clinical-500 bg-clinical-50/60 dark:bg-clinical-700/15 p-4">
          <div className="source-tab text-clinical-700 dark:text-clinical-200">ATIVO</div>
          <div className="font-display text-lg text-ink-900 dark:text-paper mt-1">Modo Prova</div>
          <p className="text-sm text-ink-400 mt-1">Questão + resposta correta + comentário do próprio PDF.</p>
        </div>
      </div>

      <label htmlFor="exam-target-deck" className="block text-sm font-medium text-ink-700 dark:text-ink-100 mb-2">Deck de destino</label>
      {decksLoading ? (
        <div className="h-11 rounded-lg border border-ink-200 dark:border-ink-800 animate-pulse mb-6" />
      ) : decks.length > 0 ? (
        <select
          id="exam-target-deck"
          value={targetDeckId ?? ""}
          disabled={Boolean(analysis)}
          onChange={(event) => {
            setTargetDeckId(event.target.value || null);
            resetAnalysis();
          }}
          className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3.5 py-3 text-sm text-ink-900 dark:text-paper outline-none focus:border-clinical-500 mb-6 disabled:opacity-60"
        >
          <option value="">Selecione um deck</option>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>{deck.specialty} · {deck.title}</option>
          ))}
        </select>
      ) : (
        <div className="rounded-card border border-ink-200 dark:border-ink-800 p-4 mb-6">
          <p className="text-sm text-ink-500 dark:text-ink-200">Você precisa ter pelo menos um deck antes de importar uma prova.</p>
          <Link to="/library" className="inline-block mt-2 text-sm font-medium text-clinical-600 dark:text-clinical-300">Ir para a Biblioteca e criar um deck →</Link>
        </div>
      )}

      <div
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { event.preventDefault(); if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={handleDrop}
        className={`rounded-card border-2 border-dashed transition-colors ${dragging ? "border-clinical-500 bg-clinical-50/60 dark:bg-clinical-700/15" : file ? "border-clinical-400 bg-white dark:bg-ink-900" : "border-ink-200 dark:border-ink-800"}`}
      >
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleInputChange} />
        {file ? (
          <div className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="h-12 w-12 shrink-0 rounded-lg border border-ink-200 dark:border-ink-700 flex items-center justify-center font-mono text-xs text-clinical-700 dark:text-clinical-300">PDF</div>
              <div className="min-w-0 flex-1">
                <div className="source-tab text-clinical-600 dark:text-clinical-300">PROVA SELECIONADA</div>
                <p className="font-medium text-ink-900 dark:text-paper mt-1 break-words">{file.name}</p>
                <p className="text-sm text-ink-400 mt-1">{formatBytes(file.size)} · PDF</p>
                {selectedDeck && <p className="text-sm text-ink-400 mt-1">Destino: {selectedDeck.title}</p>}
              </div>
              {!analysis && (
                <div className="flex gap-3 text-sm shrink-0">
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={processing} className="font-medium text-clinical-600 dark:text-clinical-300 disabled:opacity-40">Trocar</button>
                  <button type="button" onClick={removeFile} disabled={processing} className="text-signal-600 dark:text-signal-400 disabled:opacity-40">Remover</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-2 px-5 py-14 text-center">
            <span className="font-display text-xl text-ink-900 dark:text-paper">Arraste a prova ou clique para selecionar</span>
            <span className="text-sm text-ink-400">PDF · até 25 MB</span>
          </button>
        )}
      </div>

      {fileError && <div className="mt-3 rounded-lg bg-signal-400/10 px-3.5 py-3 text-sm text-signal-600 dark:text-signal-400">{fileError}</div>}
      {actionError && <div className="mt-3 rounded-lg border border-signal-300/60 bg-signal-400/10 px-3.5 py-3 text-sm text-signal-700 dark:text-signal-300">{actionError}</div>}

      {!analysis && (
        <button
          type="button"
          onClick={() => void handleAnalyze()}
          disabled={!canAnalyze}
          className="mt-6 w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-3 text-sm font-medium disabled:opacity-40"
        >
          {processing ? processingLabel : "Analisar prova"}
        </button>
      )}

      {analysis && (
        <section className="mt-7">
          <div className="rounded-card border border-clinical-300 dark:border-clinical-800 bg-clinical-50/50 dark:bg-clinical-900/10 p-4 sm:p-5">
            <div className="source-tab text-clinical-700 dark:text-clinical-200">ANÁLISE CONCLUÍDA</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
              <Metric value={analysis.totalQuestions} label="Encontradas" />
              <Metric value={analysis.uniqueQuestions} label="Únicas" />
              <Metric value={analysis.duplicateQuestions} label="Repetidas" />
              <Metric value={analysis.imageDependentQuestions} label="Com imagem" />
              <Metric value={analysis.usableQuestions.length} label="Prontas" />
            </div>
            <p className="text-sm text-ink-500 dark:text-ink-200 mt-4 leading-6">
              Questões repetidas foram unificadas pelo código. Questões que dependem de figura, imagem, gráfico, traçado ou nomograma foram descartadas e não podem ser selecionadas.
            </p>
            {analysis.invalidQuestions > 0 && (
              <p className="text-xs text-ink-400 mt-2">{analysis.invalidQuestions} questões também foram ignoradas por não terem enunciado, código ou uma única alternativa marcada como CORRETA.</p>
            )}
          </div>

          {analysis.discardedImageQuestions.length > 0 && (
            <details className="mt-4 rounded-lg border border-ink-200 dark:border-ink-800 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-ink-700 dark:text-paper">Ver questões descartadas por imagem ({analysis.discardedImageQuestions.length})</summary>
              <div className="mt-3 space-y-2">
                {analysis.discardedImageQuestions.map((question) => (
                  <div key={question.id} className="text-xs text-ink-400">
                    Prova {question.examId || "—"} · Questão {question.number} · Código {question.code} · {question.imageReason}
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="mt-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <div className="source-tab text-clinical-600 dark:text-clinical-300">QUESTÕES APROVEITÁVEIS</div>
              <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">Escolha o que vira flashcard</h2>
              <p className="text-sm text-ink-400 mt-1">{selectedCount} selecionadas</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {examIds.length > 1 && (
                <select value={examFilter} onChange={(event) => setExamFilter(event.target.value)} className="rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2 text-sm text-ink-700 dark:text-paper">
                  <option value="all">Todas as provas</option>
                  {examIds.map((examId) => <option key={examId} value={examId}>Prova {examId}</option>)}
                </select>
              )}
              <button type="button" onClick={toggleVisible} className="rounded-lg border border-ink-200 dark:border-ink-700 px-3.5 py-2 text-sm font-medium text-ink-700 dark:text-paper">
                {visibleAllSelected ? "Desmarcar visíveis" : "Selecionar visíveis"}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {visibleQuestions.map((question) => (
              <label key={question.id} className={`block rounded-lg border px-4 py-3 cursor-pointer transition-colors ${selectedIds.has(question.id) ? "border-clinical-300 bg-clinical-50/50 dark:border-clinical-800 dark:bg-clinical-900/10" : "border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900"}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selectedIds.has(question.id)} onChange={() => toggleQuestion(question.id)} className="mt-1 h-4 w-4 shrink-0 rounded border-ink-300 text-clinical-600 focus:ring-clinical-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="source-tab text-clinical-600 dark:text-clinical-300">PROVA {question.examId || "—"} · Q{question.number} · {question.code}</span>
                      <span className="text-xs text-ink-400">{difficultyLabel(question.difficulty)}</span>
                    </div>
                    <p className="text-sm font-medium text-ink-800 dark:text-paper mt-1.5 line-clamp-3">{question.question}</p>
                    <p className="text-xs text-ink-400 mt-1.5">{question.topic}{question.subarea && question.subarea !== question.topic ? ` · ${question.subarea}` : ""}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6 rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 sm:p-5">
            <div className="source-tab">FORMATO DOS FLASHCARDS</div>
            <p className="text-sm text-ink-400 mt-1 leading-6">
              O gabarito do PDF é usado internamente e fica oculto nesta análise. Escolha como o conteúdo será levado para a revisão.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={() => setCardStyle("faithful")}
                disabled={creatingCards}
                className={`rounded-lg border p-4 text-left transition-colors ${cardStyle === "faithful" ? "border-clinical-400 bg-clinical-50/60 dark:border-clinical-700 dark:bg-clinical-900/15" : "border-ink-200 dark:border-ink-700"}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${cardStyle === "faithful" ? "border-clinical-600" : "border-ink-300"}`}>
                    {cardStyle === "faithful" && <span className="h-2 w-2 rounded-full bg-clinical-600" />}
                  </span>
                  <span className="text-sm font-medium text-ink-900 dark:text-paper">Fiel à questão</span>
                </div>
                <p className="text-xs text-ink-400 mt-2 leading-5">Mantém o enunciado, o gabarito e o comentário da prova. Melhor para revisar o raciocínio original.</p>
              </button>

              <button
                type="button"
                onClick={() => setCardStyle("memorization")}
                disabled={creatingCards}
                className={`rounded-lg border p-4 text-left transition-colors ${cardStyle === "memorization" ? "border-clinical-400 bg-clinical-50/60 dark:border-clinical-700 dark:bg-clinical-900/15" : "border-ink-200 dark:border-ink-700"}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${cardStyle === "memorization" ? "border-clinical-600" : "border-ink-300"}`}>
                    {cardStyle === "memorization" && <span className="h-2 w-2 rounded-full bg-clinical-600" />}
                  </span>
                  <span className="text-sm font-medium text-ink-900 dark:text-paper">Memorização rápida</span>
                </div>
                <p className="text-xs text-ink-400 mt-2 leading-5">A IA reduz cada questão a um card básico, curto e atômico. O gabarito continua sendo a base e não pode ser trocado.</p>
              </button>
            </div>

            {cardStyle === "memorization" && (
              <div className="mt-3 rounded-lg bg-paper dark:bg-ink-950/50 border border-ink-100 dark:border-ink-800 px-3.5 py-3 text-xs text-ink-400 leading-5">
                A IA é usada somente para encurtar pergunta, resposta e explicação. As alternativas erradas são ignoradas. Se a IA estiver indisponível, você poderá voltar ao formato fiel à prova sem perder a análise.
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleCreateCards()}
              disabled={selectedCount === 0 || creatingCards}
              className="mt-4 w-full rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper py-3 text-sm font-medium disabled:opacity-40"
            >
              {creatingCards
                ? cardStyle === "memorization"
                  ? `Simplificando ${createProgress?.completed ?? 0}/${createProgress?.total ?? selectedCount}…`
                  : "Preparando cards…"
                : cardStyle === "memorization"
                  ? `Simplificar ${selectedCount} ${selectedCount === 1 ? "questão" : "questões"} e revisar`
                  : `Criar ${selectedCount} ${selectedCount === 1 ? "flashcard" : "flashcards"} e revisar`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-display text-xl text-ink-900 dark:text-paper">{value}</div>
      <div className="text-xs text-ink-400 mt-0.5">{label}</div>
    </div>
  );
}
