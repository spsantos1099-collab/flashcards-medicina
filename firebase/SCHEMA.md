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

## Fase 6 — metadados de extração

Em `documents/{uid}/{documentId}`, além dos metadados do arquivo, a extração local pode registrar:

- `extractionStatus`: `pending | processing | ready | error`
- `extractionIssue`: código de erro quando existir
- `pageCount`: quantidade de páginas (PDF)
- `pagesWithText`: páginas com texto extraível (PDF)
- `characterCount`: quantidade aproximada de caracteres extraídos
- `wordCount`: quantidade aproximada de palavras
- `warningCount`: quantidade de avisos de leitura
- `extractedAt`: horário em que a extração terminou
- `extractedTextStored`: sempre `false`

O texto extraído e o conteúdo página a página **não são persistidos no Realtime Database**.

## Fase 7 — geração por IA

A Fase 7 **não grava os cards gerados no Realtime Database**. O resultado da IA
fica somente no `CreateFlowContext` até a tela de revisão. A persistência em
`cards/{uid}/{cardId}` só será habilitada depois da validação, edição e aprovação.

O texto do PDF/DOCX também continua fora do Realtime Database. Para gerar os
cards, ele é enviado temporariamente à Netlify Function e, de lá, ao provedor de
IA. A chave da IA existe somente como variável de ambiente da Netlify.
