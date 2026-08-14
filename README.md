# Fichário — Flashcards médicos com IA (Fase 2)

Plataforma de flashcards médicos gerados por IA a partir de PDFs/DOCX enviados pelo
próprio usuário, com repetição espaçada. Você não roda nada localmente: edita/envia
arquivos pelo GitHub (navegador) e a Netlify builda e publica sozinha.

## Onde estamos: Fase 2 de 15 — Firebase + autenticação

Agora o login, o cadastro, a recuperação de senha, a proteção das rotas internas
e o logout já são **de verdade**, usando o Firebase Authentication. O dashboard
e os decks continuam com dados fictícios (`src/lib/mockData.ts`) — isso vem na
Fase 3, quando ligarmos o Realtime Database.

## FAÇA AGORA — parte 1: criar o projeto no Firebase

1. Acesse **https://console.firebase.google.com** e entre com uma conta Google
   (pode ser pessoal).
2. Clique em **"Criar um projeto"**. Dê o nome `flashcards-medicina` (ou o
   que preferir) e siga o assistente até o fim (pode desativar o Google
   Analytics, não é necessário).
3. Dentro do projeto, no menu da esquerda, clique em **"Compilação" (Build) >
   "Authentication"**. Clique em **"Vamos começar"**.
4. Na aba **"Sign-in method"**, clique em **"Email/senha"**, ative a primeira
   opção (Email/senha) e clique em **"Salvar"**.
5. Ainda no menu da esquerda, clique em **"Realtime Database"**. Clique em
   **"Criar banco de dados"**. Escolha a localização (qualquer uma serve,
   ex: `us-central1`) e comece em **modo bloqueado/locked** (não "test mode"
   — vamos colar as regras corretas no passo 8).
6. Ainda no menu da esquerda, clique em **"Storage"**. Clique em **"Vamos
   começar"** e siga o assistente (mesma localização do passo anterior),
   também em modo bloqueado.
7. Clique no ícone de engrenagem (canto superior esquerdo) >
   **"Configurações do projeto"**. Role até **"Seus apps"** e clique no
   ícone **`</>`** (Web). Dê um apelido (ex: `web`) e clique em
   **"Registrar app"**. O Firebase vai mostrar um bloco de código
   `firebaseConfig` com vários valores (`apiKey`, `authDomain`, etc) —
   **deixe essa tela aberta**, vamos usar esses valores no próximo passo.
8. Volte em **Realtime Database > aba "Regras"** e substitua todo o
   conteúdo pelo que está no arquivo `firebase/database.rules.json` deste
   projeto. Clique em **"Publicar"**. Faça o mesmo em **Storage > aba
   "Regras"**, usando o conteúdo de `firebase/storage.rules`.

## FAÇA AGORA — parte 2: configurar as variáveis de ambiente na Netlify

1. No painel da Netlify, abra seu site `flashcardsmed` e clique em
   **"Configuração do projeto"** (ou "Site configuration") no menu esquerdo.
2. Clique em **"Environment variables"**.
3. Clique em **"Add a variable"** e crie, uma por uma, as 7 variáveis abaixo,
   usando os valores que você viu na tela do Firebase (passo 7 acima). O nome
   de cada variável tem que ser **exatamente** este:

   | Nome da variável | Valor vem de... |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

   Se `databaseURL` não aparecer no bloco `firebaseConfig` do Firebase, copie
   a URL que aparece no topo da página do Realtime Database (algo como
   `https://flashcards-medicina-default-rtdb.firebaseio.com`).

## FAÇA AGORA — parte 3: subir os arquivos atualizados

1. Extraia o novo zip que te enviei (mesmo processo de sempre).
2. No GitHub, abra o repositório `flashcards-medicina` e clique em **"Add
   file" > "Upload files"**.
3. Arraste a pasta inteira novamente. O GitHub atualiza sozinho os arquivos
   que já existiam e adiciona os novos.
4. Clique em **"Commit changes"**.
5. A Netlify começa um novo deploy automaticamente. Espere terminar (like
   fizemos na Fase 1) e abra o link do site de novo.

## Como saber se funcionou

- A tela de login não te deixa mais entrar direto — se você tentar abrir
  `/dashboard` sem estar logado, ela te manda de volta para `/login`.
- Em "Criar conta", cadastre um usuário de teste. Deve te levar direto para
  o dashboard, e o nome digitado aparece em "Olá, [nome] 👋".
- Feche a aba, abra o link de novo: você continua logado (sessão persistida).
- Em "Perfil", clique em "Sair" — deve te levar de volta ao login.
- Se digitar uma senha errada no login, aparece uma mensagem tipo "Email ou
  senha incorretos", não um erro técnico.

Se algo não bater com essa lista, me manda um print da tela (e, se der erro
no deploy da Netlify, um print do log também).

## Próxima fase

**Fase 3 — Realtime Database + estrutura dos usuários.** Vamos criar o perfil
do usuário no banco assim que ele se cadastra, e preparar a estrutura de
`decks`/`cards` que vai substituir os dados fictícios.

## Stack

- React + Vite + TypeScript, Tailwind CSS, React Router
- Firebase Authentication (ativo desde a Fase 2), Realtime Database e Storage
  (criados, ainda não usados pelo app — Fase 3+)
- Netlify + Netlify Functions (a Function de IA entra na Fase 7)
