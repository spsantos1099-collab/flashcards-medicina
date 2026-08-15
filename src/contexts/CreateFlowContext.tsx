import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { DocumentRecord, ExtractedDocument } from "../types";

interface CreateFlowContextValue {
  file: File | null;
  targetDeckId: string | null;
  documentRecord: DocumentRecord | null;
  extractedDocument: ExtractedDocument | null;
  setFile: (file: File | null) => void;
  setTargetDeckId: (deckId: string | null) => void;
  setDocumentRecord: (record: DocumentRecord | null) => void;
  setExtractedDocument: (document: ExtractedDocument | null) => void;
  reset: () => void;
}

const CreateFlowContext = createContext<CreateFlowContextValue | undefined>(undefined);

export function CreateFlowProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [targetDeckId, setTargetDeckId] = useState<string | null>(null);
  const [documentRecord, setDocumentRecord] = useState<DocumentRecord | null>(null);
  const [extractedDocument, setExtractedDocument] = useState<ExtractedDocument | null>(null);

  const value = useMemo<CreateFlowContextValue>(
    () => ({
      file,
      targetDeckId,
      documentRecord,
      extractedDocument,
      setFile,
      setTargetDeckId,
      setDocumentRecord,
      setExtractedDocument,
      reset: () => {
        setFile(null);
        setTargetDeckId(null);
        setDocumentRecord(null);
        setExtractedDocument(null);
      },
    }),
    [file, targetDeckId, documentRecord, extractedDocument],
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
