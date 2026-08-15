# Fichário — Flashcards médicos com IA (Fase 5)

Plataforma de estudo médico com flashcards rastreáveis. O produto foi preparado
para duas formas de criação: **Meu material** (PDF/DOCX do usuário) e, em fase
posterior, **Pesquisar por tema** (diretrizes/artigos/fontes verificáveis).
A IA nunca deve ser tratada como fonte: ela só transforma contexto-fonte em cards.

Você não precisa rodar nada localmente. Os arquivos são enviados pelo GitHub no
navegador e a Netlify faz o build e publica sozinha.

## Onde estamos: Fase 5 de 15 — seleção real de PDF/DOCX sem Storage

Concluído nesta versão:

- Fase 4 confirmada: criação, edição, exclusão e persistência de decks reais;
- tela **Criar com IA** agora recebe um arquivo de verdade por clique ou arrastar/soltar;
- aceita apenas `.pdf` e `.docx`;
- valida arquivo vazio e limite de 25 MB;
- mostra nome, formato e tamanho do documento selecionado;
- permite trocar ou remover o arquivo antes de continuar;
- permite escolher o deck de destino;
- ao abrir a criação a partir de um deck, ele já chega pré-selecionado;
- o PDF/DOCX **não é enviado para Firebase Storage**;
- o Realtime Database guarda somente metadados em `documents/{uid}/{documentId}`;
- o documento fica ligado ao deck por `sourceDocumentId` e `sourceDocumentName`;
- `creationMode` do deck passa para `upload`;
- a tela de configuração agora mostra o nome real do arquivo e o deck real;
- o botão de geração está propositalmente desabilitado até a Fase 6, para não
  apresentar cards fictícios como se tivessem sido extraídos do documento;
- a interface já apresenta os dois caminhos de produto: **Meu material** e
  **Pesquisar por tema** (este segundo ainda planejado).

## O que significa “sem Storage”

O arquivo selecionado permanece na memória do navegador enquanto a pessoa está
no fluxo de criação. Nesta fase, o Firebase recebe somente:

- nome do arquivo;
- formato;
- MIME type;
- tamanho;
- deck de destino;
- estado da extração;
- datas de criação/atualização.

Nenhum byte do PDF/DOCX, URL de arquivo ou texto extraído é salvo no Realtime
Database. Se a página for atualizada no meio do fluxo, por privacidade o navegador
pode perder o acesso ao arquivo e a tela pede para selecioná-lo novamente.

## Estrutura no Realtime Database

```text
users/{uid}
decks/{uid}/{deckId}
cards/{uid}/{cardId}
reviews/{uid}/{reviewId}
studySessions/{uid}/{sessionId}
documents/{uid}/{documentId}
```

Exemplo do documento criado nesta fase:

```text
documents/{uid}/{documentId}
  id: "..."
  deckId: "..."
  name: "Insuficiencia Cardiaca.pdf"
  extension: "pdf"
  mimeType: "application/pdf"
  sizeBytes: 1234567
  extractionStatus: "pending"
  storageMode: "browser_only"
  extractedTextStored: false
  createdAt: "..."
  updatedAt: "..."
```

## FAÇA AGORA — publicar esta versão

1. Extraia o ZIP desta versão.
2. Abra o repositório `spsantos1099-collab/flashcards-medicina` no GitHub.
3. Clique em **Add file > Upload files**.
4. Arraste **o conteúdo da pasta `flashcards-medicina` extraída**, mantendo a
   mesma estrutura do repositório.
5. Espere o GitHub terminar de carregar os arquivos e clique em **Commit changes**.
6. Abra a Netlify e espere o deploy automático ficar como publicado/sucesso.
7. Abra `https://flashcardsmed.netlify.app` e atualize a página.

Não rode `npm install`, `npm run dev`, Git ou terminal no seu computador.

## FAÇA AGORA — testar a Fase 5

### Teste 1 — abrir a partir do deck

1. Faça login.
2. Abra **Biblioteca** e entre no deck criado na Fase 4.
3. Clique em **Gerar cards com IA**.
4. Na tela seguinte, o deck de destino deve aparecer já selecionado.

### Teste 2 — selecionar um arquivo real

1. Arraste um PDF/DOCX para a área pontilhada ou clique nela.
2. O Fichário deve mostrar o nome, tamanho e formato do arquivo.
3. Teste **Trocar** e **Remover** se quiser.
4. Selecione o arquivo novamente e clique em **Continuar**.

### Teste 3 — configuração

1. A tela deve mostrar o nome real do arquivo selecionado.
2. Deve mostrar também o deck real de destino.
3. As opções de quantidade, tipos e prioridades continuam clicáveis.
4. O botão **Gerar flashcards** fica desabilitado nesta versão porque a extração
   real do texto só entra na Fase 6.

### Teste 4 — conferir o Firebase

1. Abra Firebase > Realtime Database > **Dados**.
2. Deve existir a raiz `documents`.
3. Abra `documents > SEU_UID > ID_DO_DOCUMENTO`.
4. Confirme os metadados descritos acima.
5. Abra também `decks > SEU_UID > SEU_DECK`.
6. O deck deve ter `creationMode: "upload"`, `sourceDocumentId` e
   `sourceDocumentName`.

## Regras de segurança

As regras continuam em `firebase/database.rules.json`. Cada usuário autenticado
só pode ler/escrever dentro do próprio UID em `users`, `decks`, `cards`,
`reviews`, `studySessions` e `documents`.

## Storage continua pausado

O projeto segue no Firebase Spark e não depende de Firebase Storage/Blaze.

## Próxima fase

**Fase 6 — extração local de PDF/DOCX.** O navegador passará a ler o conteúdo do
documento, identificar páginas/seções quando possível e avisar quando um PDF for
digitalizado/imagem sem texto extraível.

## Stack

- React + Vite + TypeScript + Tailwind CSS + React Router
- Firebase Authentication + Realtime Database
- Netlify (deploy automático pelo GitHub)
- Netlify Functions para a IA em fase posterior

## Fase 6 — extração local de PDF/DOCX

- PDF: `pdfjs-dist` lê o texto página a página no navegador, preservando o número da página para rastreabilidade futura.
- DOCX: `mammoth` extrai o texto no navegador. DOCX não recebe número de página porque a paginação depende do renderizador/editor.
- O texto extraído fica somente no `CreateFlowContext` durante a sessão atual e **não é salvo no Firebase**.
- O Realtime Database recebe apenas métricas da extração (`pageCount`, `pagesWithText`, `wordCount`, `characterCount`, status e horários).
- PDFs sem texto selecionável mostram um aviso de provável documento digitalizado/imagem. OCR ainda não faz parte desta fase.
