// Tipos de domínio da plataforma.
// A partir da Fase 3, estes tipos já refletem a estrutura preparada para o
// Firebase Realtime Database e para as duas origens de conteúdo do Fichário:
// material enviado pelo usuário e pesquisa com fontes verificáveis.

export type CardType = "basic" | "cloze" | "clinical_case";
export type Difficulty = "easy" | "medium" | "hard";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type SchedulerState = 0 | 1 | 2 | 3;
export type CreationMode = "upload" | "exam" | "research" | "manual";
export type SourceKind = "upload" | "guideline" | "article" | "web" | "manual";
export type SourceVerificationStatus = "user_material" | "verified" | "pending" | "manual";
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
  course: string;
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
 * - web: outra fonte web verificável aprovada pela camada de pesquisa;
 * - manual: origem explicitamente criada/editada pelo usuário, sem atribuir a autoria à IA.
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


export interface SpacedRepetitionState {
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: SchedulerState;
  lastReview?: string;
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
  srs?: SpacedRepetitionState;
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
  /** Usado em regeneração pontual para evitar devolver um card já presente na revisão. */
  excludedQuestions?: string[];
  /** Objetivos já cobertos no conjunto atual; ajuda a regeneração a buscar outro ângulo. */
  excludedObjectives?: string[];
}

export interface GenerationMeta {
  provider: "gemini" | "exam_parser";
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
  scheduledDays?: number;
  stability?: number;
  memoryDifficulty?: number;
  schedulerState?: SchedulerState;
}

export interface StudySessionRecord {
  id: string;
  deckId?: string;
  startedAt: string;
  endedAt?: string;
  reviewedCards: number;
}


export type ResearchEvidenceLevel =
  | "guideline"
  | "consensus"
  | "official_document"
  | "systematic_review"
  | "meta_analysis"
  | "review"
  | "clinical_trial"
  | "observational"
  | "other";

export type ResearchSourcePriority = "priority" | "complementary" | "international";
export type ResearchSourceVerification = "verified" | "grounded";

export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  institution: string;
  domain: string;
  provider: string;
  language: string;
  country?: string;
  year?: number;
  publishedAt?: string;
  evidenceLevel: ResearchEvidenceLevel;
  credibility: string;
  summary: string;
  whyRelevant: string;
  verificationStatus: ResearchSourceVerification;
  searchOrigin: "official" | "web" | "openalex" | "pubmed";
  priority: ResearchSourcePriority;
  score: number;
  relevanceScore?: number;
  relevanceLevel?: "high" | "medium" | "low";
  relevanceReasons?: string[];
  /** Autoridade institucional/editorial estimada para o ranking (0-100). */
  authorityScore?: number;
  /** Peso do desenho/nível de evidência para o ranking (0-100). */
  evidenceScore?: number;
  /** Quanto a fonte cobre o tema como um todo, em vez de apenas um subtema (0-100). */
  breadthScore?: number;
  breadthLevel?: "broad" | "focused" | "narrow";
  breadthReasons?: string[];
  pmid?: string;
  doi?: string;
  journal?: string;
  authors?: string[];
  publicationTypes?: string[];
  /** Documento encontrado diretamente em uma fonte institucional oficial. */
  officialDocument?: boolean;
  /** Classe interna da fonte oficial para não equiparar PCDT a página informativa genérica. */
  officialKind?: "pcdt" | "guideline" | "consensus" | "clinical_reference" | "official_pdf" | "official_page" | "public_education" | "non_document";
  /** Distingue evidência clínica forte de páginas oficiais apenas educativas/informativas. */
  officialContentClass?: "strong_clinical" | "clinical_reference" | "official_pdf" | "official_page" | "public_education" | "non_document";
  /** Fonte relacionada semanticamente ao tema, mas sem correspondência literal suficiente. */
  semanticRelation?: boolean;
  semanticBridgeTerm?: string;
  semanticBridgeScore?: number;
  /** Tópicos/keywords científicos usados na expansão semântica, quando disponíveis. */
  semanticTerms?: string[];
  /** Situação documental: versões preliminares não devem superar a diretriz final vigente. */
  officialStatus?: "final" | "summary" | "recommendation_report" | "preliminary";
  /** Bônus controlado aplicado ao ranking de documentos oficiais fortes. */
  officialBonus?: number;
  /** Indica que a URL aponta para um PDF (ou endpoint de download/display de PDF). */
  isPdf?: boolean;
  documentFormat?: "PDF" | "HTML";
  /** Página institucional que levou ao PDF, quando houver. */
  originPageUrl?: string;
}

export interface ResearchSearchMeta {
  originalTopic: string;
  normalizedTopic: string;
  queryUsed: string;
  searchedAt: string;
  totalMatches: number;
  returnedCount: number;
  queryNormalization: "grounded_web" | "mesh_clinical_fallback" | "openalex_semantic_fallback" | "literal_fallback" | "fallback";
  provider: "multi_source";
  searchMode: "grounded_web" | "indexed_fallback" | "pubmed_fallback";
  languagePreference: "pt-BR";
  searchModel?: string;
  webSearchQueries?: string[];
  fallbackUsed: boolean;
  fallbackReason?: string;
  /** Quantidade de candidatos avaliados antes do corte final. */
  candidateCount?: number;
  /** Versão do algoritmo de seleção clínica usado pela função. */
  rankingVersion?: string;
  /** A camada de descoberta direta em fontes oficiais brasileiras foi executada. */
  officialSearchUsed?: boolean;
  /** Quantos candidatos oficiais verificáveis foram encontrados antes do ranking final. */
  officialCandidateCount?: number;
  /** Consultas institucionais executadas sem depender da Pesquisa Google. */
  officialSearchQueries?: string[];
  /** Sociedades de especialidade brasileiras ativadas automaticamente a partir do tema. */
  officialAuthorities?: Array<{ key: string; specialty: string; institution: string; domain: string }>;
  /** Origem do registro de sociedades usado pela busca oficial. */
  officialAuthorityRegistry?: string;
  /** Origem da canonicalização/expansão clínica usada no modo de contingência. */
  semanticExpansionSource?: string;
  semanticSeedCount?: number;
  semanticInternationalQuery?: string;
  /** Primeira query estruturada da escada progressiva enviada ao PubMed. */
  semanticPubMedQuery?: string;
  /** Escada de queries PubMed: específica → essencial → núcleo. */
  semanticPubMedQueries?: string[];
  /** Escada equivalente para OpenAlex internacional. */
  semanticOpenAlexQueries?: string[];
  /** A canonicalização nuclear foi escolhida query-first, não por Topic do OpenAlex. */
  semanticQueryFirstUsed?: boolean;
  /** Termos da consulta original preservados como contexto/subtipo/população confiável. */
  semanticTrustedModifiers?: string[];
  /** Origem do candidato que venceu como núcleo (query/title/keyword). */
  semanticNuclearSource?: string;
  semanticTerms?: string[];
  semanticBridgeUsed?: boolean;
  /** Canonicalização clínica por MeSH/NLM usada no modo de contingência. */
  meshUsed?: boolean;
  meshDescriptors?: string[];
  meshNuclearDescriptor?: string;
  /** Indica que a semente OpenAlex precisou repetir a busca sem language:pt. */
  semanticLanguageFallbackUsed?: boolean;
  semanticPortugueseSeedCount?: number;
  semanticUnrestrictedSeedCount?: number;
}

export interface DashboardSummary {
  dueToday: number;
  newCards: number;
  studiedToday: number;
  streakDays: number;
}
