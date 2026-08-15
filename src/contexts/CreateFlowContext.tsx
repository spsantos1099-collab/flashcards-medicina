import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { DocumentRecord, ExtractedDocument, Flashcard, GenerationMeta } from "../types";

interface CreateFlowContextValue {
  file: File | null;
  targetDeckId: string | null;
  documentRecord: DocumentRecord | null;
  extractedDocument: ExtractedDocument | null;
  generatedCards: Flashcard[];
  generationMeta: GenerationMeta | null;
  setFile: (file: File | null) => void;
  setTargetDeckId: (deckId: string | null) => void;
  setDocumentRecord: (record: DocumentRecord | null) => void;
  setExtractedDocument: (document: ExtractedDocument | null) => void;
  setGeneratedCards: (cards: Flashcard[]) => void;
  setGenerationMeta: (meta: GenerationMeta | null) => void;
  reset: () => void;
}

const CreateFlowContext = createContext<CreateFlowContextValue | undefined>(undefined);

export function CreateFlowProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [targetDeckId, setTargetDeckId] = useState<string | null>(null);
  const [documentRecord, setDocumentRecord] = useState<DocumentRecord | null>(null);
  const [extractedDocument, setExtractedDocument] = useState<ExtractedDocument | null>(null);
  const [generatedCards, setGeneratedCards] = useState<Flashcard[]>([]);
  const [generationMeta, setGenerationMeta] = useState<GenerationMeta | null>(null);

  const value = useMemo<CreateFlowContextValue>(
    () => ({
      file,
      targetDeckId,
      documentRecord,
      extractedDocument,
      generatedCards,
      generationMeta,
      setFile,
      setTargetDeckId,
      setDocumentRecord,
      setExtractedDocument,
      setGeneratedCards,
      setGenerationMeta,
      reset: () => {
        setFile(null);
        setTargetDeckId(null);
        setDocumentRecord(null);
        setExtractedDocument(null);
        setGeneratedCards([]);
        setGenerationMeta(null);
      },
    }),
    [file, targetDeckId, documentRecord, extractedDocument, generatedCards, generationMeta],
  );

  return <CreateFlowContext.Provider value={value}>{children}</CreateFlowContext.Provider>;
}

export function useCreateFlow() {
  const context = useContext(CreateFlowContext);
  if (!context) {
    throw new Error("useCreateFlow precisa estar dentro de <CreateFlowProvider>");
  }
  return context;
}
