# Fichário — Flashcards médicos com IA (Fase 4)

Plataforma de estudo médico com flashcards rastreáveis. O produto foi preparado
para duas formas de criação: **Meu material** (PDF/DOCX do usuário) e, em fase
posterior, **Pesquisar tema com fontes** (diretrizes/artigos/fontes verificáveis).
A IA nunca deve ser tratada como fonte: ela só transforma contexto-fonte em cards.

Você não precisa rodar nada localmente. Os arquivos são enviados pelo GitHub no
navegador e a Netlify faz o build e publica sozinha.

## Onde estamos: Fase 4 de 15 — decks reais

Concluído nesta versão:

- Fase 3 confirmada: perfil privado real em `users/{uid}`;
- Biblioteca deixou de usar decks fictícios;
- Dashboard deixou de usar decks e números fictícios;
- criação de deck real em `decks/{uid}/{deckId}`;
- edição de nome, especialidade e tema;
- exclusão de deck;
- busca de decks por nome, especialidade ou tema;
- atualização automática da Biblioteca e Dashboard quando os dados mudam;
- tela de detalhe do deck agora carrega o deck real pelo ID;
- totais de cards/revisões vêm dos próprios decks e começam em zero;
- métricas ainda não implementadas (estudados hoje/sequência) aparecem como zero,
  nunca como dados demonstrativos;
- arquitetura continua preparada para decks criados manualmente, por upload ou
  por pesquisa com fontes verificáveis.

Os flashcards exibidos nas telas de estudo/revisão da geração ainda são de
pré-visualização. Eles serão substituídos quando as fases de upload, extração e IA
forem implementadas.

## Estrutura no Realtime Database

```text
users/{uid}
decks/{uid}/{deckId}
cards/{uid}/{cardId}
reviews/{uid}/{reviewId}
studySessions/{uid}/{sessionId}
documents/{uid}/{documentId}
```

Nesta fase, ao criar o primeiro deck, a raiz `decks` passa a aparecer de verdade
no console do Firebase.

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

## FAÇA AGORA — testar a Fase 4

### Teste 1 — os mocks devem sumir

1. Faça login.
2. Abra o Dashboard.
3. Os decks fictícios Cardiologia, Neurologia, Pneumologia e Infectologia não
   devem mais aparecer.
4. Como ainda não existe deck real, deve aparecer o estado vazio.
5. Os números do topo devem estar zerados em vez de mostrar estatísticas fictícias.

### Teste 2 — criar um deck real

1. Abra **Biblioteca**.
2. Clique em **+ Novo deck**.
3. Para testar, preencha por exemplo:
   - Nome: `Insuficiência Cardíaca`;
   - Especialidade: `Cardiologia`;
   - Tema: `ICFEr`.
4. Clique em **Criar deck**.
5. O deck deve aparecer imediatamente na Biblioteca.
6. Volte ao Dashboard: ele também deve aparecer em **Seus decks**.

### Teste 3 — conferir no Firebase

1. Abra Firebase > Realtime Database > **Dados**.
2. Agora deve aparecer `decks`.
3. Abra `decks > SEU_UID > ID_DO_DECK`.
4. Deve existir `title`, `specialty`, `topic`, `creationMode`, os contadores em
   zero e as datas `createdAt`/`updatedAt`.

### Teste 4 — editar e excluir

1. Clique no deck.
2. Use **Editar deck**, altere alguma informação e salve.
3. Confirme que a Biblioteca foi atualizada.
4. Se quiser testar exclusão, clique em **Excluir** e confirme.
5. O deck deve desaparecer também do Realtime Database.

## Regras de segurança

As regras continuam em `firebase/database.rules.json`. Cada usuário autenticado
só pode ler/escrever dentro do próprio UID em `users`, `decks`, `cards`,
`reviews`, `studySessions` e `documents`.

## Storage continua pausado

O projeto não depende de Firebase Storage. Na Fase 5, o upload será implementado
sem exigir Blaze/cartão: o arquivo será trabalhado no navegador e só os dados
necessários serão persistidos.

## Próxima fase

**Fase 5 — upload de documento sem Firebase Storage pago.** A tela de criação
passará a receber o arquivo de verdade e vinculá-lo a um deck, ainda sem depender
de cartão ou instalação local.

## Stack

- React + Vite + TypeScript + Tailwind CSS + React Router
- Firebase Authentication + Realtime Database
- Netlify (deploy automático pelo GitHub)
- Netlify Functions para a IA em fase posterior
