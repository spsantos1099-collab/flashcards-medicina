# Fichário — Flashcards médicos com IA

Plataforma de estudo médico com flashcards rastreáveis. O produto foi preparado
para duas origens de conteúdo: **Meu material** (PDF/DOCX do usuário) e, em fase
posterior, **Pesquisar por tema** (diretrizes, artigos e outras fontes médicas
verificáveis). A IA nunca é tratada como fonte: ela transforma um contexto-fonte
em cards e cada card guarda sua origem.

## Estado atual — Fase 7.5

Já estão funcionando:

- React + Vite + TypeScript + Tailwind + React Router;
- Firebase Authentication por email/senha;
- Firebase Realtime Database com dados separados por UID;
- criação, edição e exclusão de decks reais;
- upload local de PDF/DOCX sem Firebase Storage;
- extração de PDF página a página (`pdfjs-dist`) e DOCX (`mammoth`);
- metadados da extração no Realtime Database sem salvar o texto do documento;
- Netlify Function protegendo a chave `GEMINI_API_KEY`;
- geração real de flashcards com Gemini em lotes pequenos para evitar timeout;
- validação literal da página/trecho-fonte de cada card;
- cards Básico, Cloze e Caso clínico;
- resposta e fonte ocultas até clicar em **Mostrar resposta**;
- sintaxe técnica de Cloze escondida da interface.

### Qualidade da geração — Fase 7.5

A geração agora é orientada para **internato, residência e provas**, e não apenas
para extração de fatos. O prompt prioriza diagnóstico, conduta, indicações,
contraindicações, limiares, doses, classificações, encaminhamento, exceções e
segurança quando esses pontos existirem no material.

Regras principais:

- **1 card = 1 objetivo principal de recuperação**;
- evitar respostas com listas longas quando os itens podem virar cards menores;
- listas completas só permanecem juntas quando forem curtas, canônicas e valer a
  pena memorizar como conjunto;
- casos clínicos só podem usar dados sustentados pelo documento;
- preservar literalmente números, unidades, doses, critérios e exceções;
- evitar trivia e detalhes periféricos quando houver conteúdo de maior valor;
- evitar perguntas duplicadas ou apenas reformuladas.

O backend também aplica uma proteção de atomicidade e pode descartar cards muito
amplos antes de mostrá-los ao usuário.

### Reposição automática da quantidade

A quantidade escolhida passou a ser um **número-alvo**. Se, por exemplo, forem
solicitados 15 cards e apenas 12 sobreviverem às validações de fonte, qualidade e
duplicidade, o Fichário faz até duas rodadas de reposição. Nessas rodadas ele:

1. procura páginas menos cobertas;
2. informa à IA quais perguntas já foram aceitas;
3. pede apenas cards novos e de alto valor;
4. interrompe a reposição se ela começar a repetir conteúdo.

A prioridade continua sendo qualidade: se não houver conteúdo suficiente, o
Fichário pode retornar menos cards em vez de inventar ou forçar perguntas fracas.

### Modos de quantidade

- **Essencial — 8 cards:** somente pontos de alto valor de prova ou que mudam conduta;
- **Equilibrada — 15 cards:** diagnóstico, conduta, critérios e números importantes;
- **Detalhada — 30 cards:** cobertura ampla, incluindo exceções e pontos de segunda linha;
- **Personalizada — 3 a 40 cards:** número-alvo escolhido pelo usuário.

## Privacidade e armazenamento

O PDF/DOCX original não é enviado para Firebase Storage. O texto extraído fica na
memória da sessão do navegador e não é salvo no Realtime Database. Durante a
geração, os trechos necessários são enviados à Netlify Function e então ao
provedor de IA.

Não usar materiais com dados identificáveis de pacientes.

## Estrutura principal do Realtime Database

```text
users/{uid}
decks/{uid}/{deckId}
cards/{uid}/{cardId}
reviews/{uid}/{reviewId}
studySessions/{uid}/{sessionId}
documents/{uid}/{documentId}
```

## IA / Netlify

A variável obrigatória é:

```text
GEMINI_API_KEY
```

Ela deve permanecer na Netlify, sem prefixo `VITE_`. O gerador de flashcards usa
por padrão `gemini-3.5-flash-lite`; uma troca futura específica pode ser feita
com `GEMINI_FLASHCARD_MODEL`.

## Publicação

O fluxo do projeto não exige terminal local:

1. extraia o ZIP;
2. abra a pasta `flashcards-medicina`;
3. no GitHub, use **Add file > Upload files**;
4. envie todos os arquivos e pastas mantendo a estrutura;
5. faça **Commit changes**;
6. aguarde o deploy automático da Netlify;
7. teste pelo site publicado.

Não é necessário rodar `npm install`, `npm run dev` ou Git no computador local.

## Próxima etapa

Depois de validar a qualidade da Fase 7.5 com materiais reais, a próxima etapa é
liberar **edição/aprovação individual e salvamento dos cards no Firebase**, antes
do modo de estudo e repetição espaçada.
