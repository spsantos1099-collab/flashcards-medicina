# Estrutura do Realtime Database — Fichário

A Fase 3 prepara estas raízes privadas por usuário:

```text
users/{uid}
decks/{uid}/{deckId}
cards/{uid}/{cardId}
reviews/{uid}/{reviewId}
studySessions/{uid}/{sessionId}
documents/{uid}/{documentId}
```

## users/{uid}

O perfil é criado automaticamente no primeiro cadastro/login depois da Fase 3.

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

Os decks serão persistidos na Fase 4. O modelo já prevê `creationMode`:

- `upload`: criado a partir de PDF/DOCX do usuário;
- `research`: criado a partir de pesquisa com fontes verificáveis.

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

O Realtime Database não exibe nós vazios. Por isso `decks`, `cards`, `reviews`,
`studySessions` e `documents` só aparecerão na aba **Dados** quando o primeiro
registro real de cada tipo for salvo. As regras de segurança já deixam essas
raízes preparadas desde agora.
