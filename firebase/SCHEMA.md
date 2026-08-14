# Estrutura do Realtime Database — Fichário

```text
users/{uid}
decks/{uid}/{deckId}
cards/{uid}/{cardId}
reviews/{uid}/{reviewId}
studySessions/{uid}/{sessionId}
documents/{uid}/{documentId}
```

## users/{uid}

```json
{
  "uid": "firebase-auth-uid",
  "name": "Nome da pessoa",
  "email": "email@exemplo.com",
  "course": "Medicina",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "lastLoginAt": "ISO-8601"
}
```

## decks/{uid}/{deckId}

A partir da Fase 4, decks são dados reais.

```json
{
  "id": "firebase-generated-id",
  "title": "Insuficiência Cardíaca",
  "specialty": "Cardiologia",
  "topic": "ICFEr",
  "creationMode": "manual",
  "totalCards": 0,
  "dueToday": 0,
  "newCards": 0,
  "learnedCards": 0,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

`creationMode` pode ser:

- `manual`: deck criado como pasta/organização antes de receber cards;
- `upload`: deck originado de PDF/DOCX do usuário;
- `research`: deck originado de pesquisa com fontes verificáveis.

## cards/{uid}/{cardId}

Cada card guarda `sources[]`. A IA nunca é uma fonte. Uma fonte pode ser:

- `upload` — material enviado pelo usuário;
- `guideline` — diretriz ou protocolo;
- `article` — artigo científico;
- `web` — outra fonte web verificável aprovada pela camada de pesquisa.

O modelo também prevê `hasSourceConflict` e `sourceConflictNote` para sinalizar
quando fontes confiáveis divergem.

## documents/{uid}/{documentId}

Como o Firebase Storage está pausado, o modelo atual usa `storageMode` igual a
`browser_only`. O arquivo bruto não é enviado ao Firebase nesta fase.

## Importante sobre o console do Firebase

O Realtime Database não exibe nós vazios. Por isso `cards`, `reviews`,
`studySessions` e `documents` só aparecerão quando o primeiro registro real de
cada tipo for salvo. `decks` passa a aparecer assim que o primeiro deck for criado.
