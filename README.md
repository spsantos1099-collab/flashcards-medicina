# Fichário — Flashcards médicos com IA

Plataforma de estudo médico com flashcards rastreáveis. O produto foi preparado
para duas origens de conteúdo: **Meu material** (PDF/DOCX do usuário) e, em fase
posterior, **Pesquisar por tema** (diretrizes, artigos e outras fontes médicas
verificáveis). A IA nunca é tratada como fonte: ela transforma um contexto-fonte
em cards e cada card guarda sua origem.

## Estado atual — Fase 7.7

Já estão funcionando:

- React + Vite + TypeScript + Tailwind + React Router;
- Firebase Authentication por email/senha;
- Firebase Realtime Database com dados separados por UID;
- criação, edição e exclusão de decks reais;
- upload local de PDF/DOCX sem Firebase Storage;
- extração de PDF página a página (`pdfjs-dist`) e DOCX (`mammoth`);
- metadados da extração no Realtime Database sem salvar o texto do documento;
- Netlify Function protegendo a chave `GEMINI_API_KEY`;
- geração real em lotes pequenos, com recuperação automática de falhas transitórias;
- cards Básico, Cloze e Caso clínico;
- resposta e fontes ocultas até clicar em **Mostrar resposta**;
- sintaxe técnica de Cloze escondida da interface;
- rastreabilidade por uma ou várias evidências do documento.

## Pipeline confiável de geração — Fase 7.7

A geração deixou de ser uma única chamada de IA. O fluxo agora é:

```text
PDF/DOCX
  → geração por tipo de card
  → verificação local das fontes
  → deduplicação por objetivo de aprendizagem
  → segundo revisor para casos clínicos
  → reposição automática do que faltar
  → tela de revisão
```

### Roteamento de modelos

- **Básico e Cloze:** `gemini-3.5-flash-lite`, priorizando baixa latência;
- **Caso clínico:** `gemini-3.5-flash`, para tarefas que exigem aplicação de critérios;
- **Segundo revisor de caso clínico:** `gemini-3.5-flash`.

As variáveis opcionais para trocar os modelos no futuro são:

```text
GEMINI_FLASHCARD_FAST_MODEL
GEMINI_FLASHCARD_CLINICAL_MODEL
GEMINI_FLASHCARD_VALIDATOR_MODEL
```

Se não existirem, os modelos acima são usados automaticamente.

### Resiliência

Erros transitórios (`408`, `429`, `5xx`, timeout e falha de rede) recebem novas
tentativas automáticas com espera progressiva e jitter. Um lote que falha não
apaga os cards já aprovados. O sistema continua com os demais lotes e tenta
repor o que ficou faltando depois.

Erros de configuração (`400`, `401`, `403`) não entram em loop de retry.

### Casos clínicos

Casos clínicos passam por duas etapas independentes:

1. geração;
2. revisão lógica por uma segunda chamada.

O segundo revisor rejeita casos quando, por exemplo:

- a resposta não decorre dos dados apresentados;
- falta um critério obrigatório;
- uma regra com **OU** foi tratada como **E** (ou o contrário);
- a conclusão depende de informação médica externa ao documento;
- há contradição entre enunciado, resposta e fonte;
- as evidências não permitem auditar os dados decisivos do caso.

Casos rejeitados não chegam à tela; entram na reposição automática.

### Tipos escolhidos são respeitados

A quantidade-alvo é dividida entre os tipos selecionados. Assim, se o usuário
selecionar Básico + Cloze + Caso clínico para 15 cards, o Fichário tenta gerar
5 de cada tipo. Selecionar somente Caso clínico faz o alvo inteiro ser dedicado
a casos clínicos.

### Deduplicação semântica

Cada geração recebe um `learningObjective` canônico. O Fichário compara objetivo,
pergunta, resposta e evidência para impedir que o mesmo conhecimento apareça
como dois cards apenas porque um foi escrito como Básico e outro como Cloze.

### Verificação de fonte tolerante a artefatos de PDF

A origem continua obrigatória, mas a comparação normaliza artefatos típicos de
extração, como:

- palavras quebradas por hífen/fim de linha;
- espaços e quebras de linha;
- `m²` versus `m 2`;
- caracteres Unicode equivalentes;
- pontuação de layout.

Isso reduz falsos descartes sem aceitar uma afirmação que não esteja realmente
ancorada na página indicada.


## Refinamentos da Fase 7.7

- casos clínicos distinguem **background narrativo** de **dados decisivos**;
- detalhes de cenário podem ser criados para dar realismo, desde que não inventem uma regra médica;
- dados que determinam diagnóstico/conduta continuam obrigatoriamente ancorados no documento;
- o segundo revisor rejeita "casos" que são apenas perguntas factuais com um paciente decorativo;
- Cloze usa, por padrão, uma única lacuna de alto valor e evita esconder palavras banais;
- a verificação de fonte tolera melhor artefatos de extração sem abandonar a página-fonte;
- casos clínicos são gerados em lotes menores para reduzir timeout;
- a reposição automática é mais persistente e suporta várias rodadas sem perder cards já aprovados.

## Qualidade pedagógica

- **1 card = 1 objetivo principal de recuperação**;
- priorizar diagnóstico, conduta, indicações, contraindicações, limiares, doses,
  classificações, encaminhamento, exceções e segurança;
- evitar trivia e detalhes periféricos quando houver conteúdo de maior valor;
- respostas longas/listas são quebradas quando possível;
- casos clínicos devem exigir aplicação, não apenas recitação;
- números, unidades, critérios e conectores lógicos devem ser preservados.

## Modos de quantidade

- **Essencial — 8 cards**;
- **Equilibrada — 15 cards**;
- **Detalhada — 30 cards**;
- **Personalizada — 3 a 40 cards**.

A quantidade é um alvo, não uma obrigação de inventar conteúdo. Se o sistema
não conseguir validar todos os cards, retorna menos e informa isso na revisão.

## Privacidade e armazenamento

O PDF/DOCX original não é enviado para Firebase Storage. O texto extraído fica na
memória da sessão do navegador e não é salvo no Realtime Database. Durante a
geração, somente os trechos necessários aos lotes são enviados à Netlify Function
e então ao provedor de IA.

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

Ela deve permanecer na Netlify, sem prefixo `VITE_`.

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

Depois de validar o pipeline 7.7 com materiais reais, a próxima etapa é liberar
**edição/aprovação individual e salvamento dos cards no Firebase**, antes do modo
de estudo e repetição espaçada.
