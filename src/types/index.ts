// Tipos de domínio da plataforma.
// A partir da Fase 3, estes tipos já refletem a estrutura preparada para o
// Firebase Realtime Database e para as duas origens de conteúdo do Fichário:
// material enviado pelo usuário e pesquisa com fontes verificáveis.

export type CardType = "basic" | "cloze" | "clinical_case";
export type Difficulty = "easy" | "medium" | "hard";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type CreationMode = "upload" | "research" | "manual";
export type SourceKind = "upload" | "guideline" | "article" | "web";
export type SourceVerificationStatus = "user_material" | "verified" | "pending";
export type DocumentExtension = "pdf" | "docx";
export type ExtractionIssue =
  | "no_extractable_text"
  | "password_protected"
  | "invalid_document"
  | "unknown";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  course: "Medicina";
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

/**
 * Uma fonte rastreável usada na criação de um flashcard.
 *
 * - upload: PDF/DOCX enviado pelo usuário;
 * - guideline: diretriz/protocolo médico;
 * - article: artigo científico;
 * - web: outra fonte web verificável aprovada pela camada de pesquisa.
 *
 * Um card pode ter uma ou várias fontes. A IA nunca deve ser tratada como fonte.
 */
export interface CardSource {
  id: string;
  kind: SourceKind;
  title: string;
  provider?: string;
  documentId?: string;
  page?: number;
  section?: string;
  excerpt?: string;
  url?: string;
  publishedAt?: string;
  accessedAt?: string;
  country?: string;
  pmid?: string;
  doi?: string;
  verificationStatus: SourceVerificationStatus;
  supports?: string;
}

export interface Flashcard {
  id: string;
  deckId: string;
  type: CardType;
  question: string;
  answer: string;
  explanation?: string;
  topic: string;
  tags: string[];
  difficulty: Difficulty;
  learningObjective?: string;
  sources: CardSource[];
  hasSourceConflict?: boolean;
  sourceConflictNote?: string;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Deck {
  id: string;
  title: string;
  specialty: string;
  topic?: string;
  creationMode?: CreationMode;
  totalCards: number;
  dueToday: number;
  newCards: number;
  learnedCards: number;
  sourceDocumentName?: string;
  sourceDocumentId?: string;
  createdAt?: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  deckId: string;
  name: string;
  extension: DocumentExtension;
  mimeType: string;
  sizeBytes?: number;
  extractionStatus: "pending" | "processing" | "ready" | "error";
  extractionIssue?: ExtractionIssue;
  pageCount?: number;
  pagesWithText?: number;
  characterCount?: number;
  wordCount?: number;
  warningCount?: number;
  extractedAt?: string;
  storageMode: "browser_only";
  extractedTextStored: false;
  createdAt: string;
  updatedAt: string;
}

/** Página extraída de um PDF. Mantida somente na memória do navegador. */
export interface ExtractedPage {
  pageNumber: number;
  text: string;
  characterCount: number;
}

/**
 * Conteúdo extraído localmente. Nunca é persistido no Realtime Database.
 * Na Fase 7, este objeto será enviado à Netlify Function em trechos controlados.
 */
export interface ExtractedDocument {
  documentId: string;
  name: string;
  extension: DocumentExtension;
  fullText: string;
  pages: ExtractedPage[];
  pageCount?: number;
  pagesWithText?: number;
  characterCount: number;
  wordCount: number;
  warnings: string[];
  extractedAt: string;
}


export interface GenerationOptions {
  amountMode: "essential" | "balanced" | "detailed" | "custom";
  cardCount: number;
  cardTypes: CardType[];
  priorities: string[];
}

export interface GenerationMeta {
  provider: "gemini";
  model: string;
  requestedCount: number;
  returnedCount: number;
  generatedAt: string;
  documentName: string;
}

export interface ReviewRecord {
  id: string;
  cardId: string;
  deckId: string;
  rating: ReviewRating;
  reviewedAt: string;
  nextReviewAt?: string;
}

export interface StudySessionRecord {
  id: string;
  deckId?: string;
  startedAt: string;
  endedAt?: string;
  reviewedCards: number;
}

export interface DashboardSummary {
  dueToday: number;
  newCards: number;
  studiedToday: number;
  streakDays: number;
}
