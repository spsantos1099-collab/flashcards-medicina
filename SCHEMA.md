# Firebase Realtime Database — estrutura atual

Cada área privada é separada por `uid`; as regras em `database.rules.json` restringem leitura e escrita ao próprio usuário autenticado.

```text
users/{uid}
  uid
  name
  email
  course
  createdAt
  updatedAt
  lastLoginAt

decks/{uid}/{deckId}
  id
  title
  specialty
  topic?
  creationMode: manual | upload | exam | research
  totalCards
  dueToday
  newCards
  learnedCards
  sourceDocumentId?
  sourceDocumentName?
  createdAt
  updatedAt

documents/{uid}/{documentId}
  id
  deckId
  name
  extension: pdf | docx
  mimeType
  sizeBytes
  extractionStatus: pending | processing | ready | error
  storageMode: browser_only
  extractedTextStored: false
  extractionIssue?
  pageCount?
  pagesWithText?
  characterCount?
  wordCount?
  warningCount?
  extractedAt?
  createdAt
  updatedAt

cards/{uid}/{cardId}
  id
  deckId
  type
  question
  answer
  explanation?
  topic
  tags[]
  difficulty
  learningObjective?
  sources[]
  hasSourceConflict?
  sourceConflictNote?
  srs?
  createdAt
  updatedAt?

reviews/{uid}/{reviewId}
  id
  cardId
  deckId
  rating
  reviewedAt
  nextReviewAt?
  scheduledDays?
  stability?
  memoryDifficulty?
  schedulerState?

studySessions/{uid}/{sessionId}
  id
  deckId?
  startedAt
  endedAt?
  reviewedCards
```

## Origem dos cards

A IA não é tratada como fonte. Cards gerados a partir de PDF/DOCX preservam as evidências do material de origem. Cards manuais recebem origem manual.

`creationMode = research` existe porque a pesquisa por tema foi implementada experimentalmente, mas essa funcionalidade está congelada no momento.

## Arquivos e privacidade

O projeto atual não usa Firebase Storage. O PDF/DOCX fica no navegador durante extração e processamento; o Realtime Database recebe metadados, não o texto integral do documento (`extractedTextStored: false`).

## Repetição espaçada

O estado FSRS pode ser persistido em `cards/{uid}/{cardId}/srs`, incluindo campos como `due`, `stability`, `difficulty`, `reps`, `lapses`, `state` e `lastReview`.
Cada avaliação também pode registrar no review a próxima revisão e os dados calculados pelo agendador.
