# Fichário — Flashcards médicos com IA (Fase 3)

Plataforma de estudo médico com flashcards rastreáveis. O produto foi preparado
para duas formas de criação: **Meu material** (PDF/DOCX do usuário) e, em fase
posterior, **Pesquisar tema com fontes** (diretrizes/artigos/fontes verificáveis).
A IA nunca deve ser tratada como fonte: ela só transforma contexto-fonte em cards.

Você não precisa rodar nada localmente. Os arquivos são enviados pelo GitHub no
navegador e a Netlify faz o build e publica sozinha.

## Onde estamos: Fase 3 de 15 — Realtime Database + perfil do usuário

Concluído nesta versão:

- Firebase Authentication continua funcionando (email/senha);
- todo usuário ganha um perfil privado em `users/{uid}` no Realtime Database;
- contas criadas antes desta fase são migradas automaticamente no próximo login;
- o Perfil e a saudação do Dashboard já conseguem usar os dados do banco;
- estrutura/tipos preparados para `decks/{uid}`, `cards/{uid}`, `reviews/{uid}`,
  `studySessions/{uid}` e `documents/{uid}`;
- modelo de flashcard atualizado para aceitar uma ou várias fontes rastreáveis;
- modelo preparado para origem `upload` ou `research` e para divergência de fontes;
- Firebase Storage continua pausado: nenhum cartão/plano pago é necessário agora;
- texto editorial da tela de autenticação atualizado sem mudar o design.

Os decks, cards e estatísticas que aparecem nas telas ainda são demonstrativos.
O CRUD real de decks entra na **Fase 4**.

## Estrutura preparada no Realtime Database

```text
users/{uid}
decks/{uid}/{deckId}
cards/{uid}/{cardId}
reviews/{uid}/{reviewId}
studySessions/{uid}/{sessionId}
documents/{uid}/{documentId}
```

Veja detalhes em `firebase/SCHEMA.md`.

> Observação: o Realtime Database não mostra nós vazios no console. Nesta fase,
> `users/{uid}` aparece de verdade. As outras raízes vão aparecer conforme dados
> reais forem criados nas fases seguintes.

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

## FAÇA AGORA — testar a Fase 3

### Teste 1 — nova frase da tela de login

1. Se estiver logado, abra **Perfil > Sair**.
2. Na tela de login, confira o painel azul-marinho da direita.
3. Ele deve mostrar:
   - `SEU FICHÁRIO DE MEDICINA`;
   - `Menos tempo organizando. Mais tempo aprendendo.`;
   - o texto sobre flashcards, fontes verificáveis e revisão espaçada;
   - `SEU MATERIAL · FONTES CONFIÁVEIS · REVISÃO INTELIGENTE`.

### Teste 2 — perfil real no Realtime Database

1. Entre normalmente com a conta que você já usa. Não precisa criar outra.
2. Acesse o console do Firebase do projeto `flashcards-medicina-7ed56`.
3. Vá em **Build/Compilação > Realtime Database > Dados**.
4. Deve existir `users` e, dentro dele, um identificador grande (o UID da conta).
5. Abra esse UID. Deve aparecer `name`, `email`, `course`, `createdAt`,
   `updatedAt` e `lastLoginAt`.
6. No site, abra **Perfil** e confirme que nome/email continuam corretos.

Se `users/{uid}` não aparecer, envie um print da aba **Dados** do Realtime
Database e, se a Netlify tiver falhado, um print do log do deploy.

## Regras de segurança

As regras continuam em `firebase/database.rules.json`. Cada usuário autenticado
só pode ler/escrever dentro do próprio UID em `users`, `decks`, `cards`,
`reviews`, `studySessions` e `documents`.

## Storage continua pausado

O projeto não depende de Firebase Storage nesta fase. Quando chegarmos ao upload,
o plano é processar PDF/DOCX no navegador sem guardar o arquivo bruto ou avaliar
uma alternativa gratuita sem cartão. Não ativar Blaze/Storage agora.

## Próxima fase

**Fase 4 — criação e gerenciamento de decks com dados reais.** Nela os mocks da
Biblioteca/Dashboard começam a ser substituídos pelo Realtime Database.

## Stack

- React + Vite + TypeScript + Tailwind CSS + React Router
- Firebase Authentication + Realtime Database
- Netlify (deploy automático pelo GitHub)
- Netlify Functions para a IA em fase posterior
