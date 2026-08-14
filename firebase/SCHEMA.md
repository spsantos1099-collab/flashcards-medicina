# Realtime Database — estrutura do Fichário

Cada coleção privada fica separada por `uid`. As regras em `database.rules.json` garantem que uma conta autenticada só leia/escreva seus próprios dados.

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
  creationMode: manual | upload | research
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
  sources[]
  hasSourceConflict?
  sourceConflictNote?
  createdAt
  updatedAt?

reviews/{uid}/{reviewId}
  id
  cardId
  deckId
  rating
  reviewedAt
  nextReviewAt?

studySessions/{uid}/{sessionId}
  id
  deckId?
  startedAt
  endedAt?
  reviewedCards
```

## Regra central de origem

A IA nunca é tratada como fonte. Todo card deverá apontar para uma ou mais fontes rastreáveis.

- `creationMode = upload`: a fonte é um PDF/DOCX enviado pelo usuário.
- `creationMode = research`: a fonte virá de pesquisa médica verificável (fase futura).
- `creationMode = manual`: deck criado manualmente antes de receber conteúdo.

## Arquivos na Fase 5

O Firebase Storage continua **fora do projeto**. Ao selecionar PDF/DOCX, o arquivo fica somente no navegador. O Realtime Database recebe apenas os metadados listados em `documents/{uid}/{documentId}`. O campo `extractedTextStored` permanece `false`; o texto extraído não será salvo no banco nesta fase.
