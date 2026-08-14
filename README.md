# Fichário — Flashcards médicos com IA (Fase 1)

Plataforma de flashcards médicos gerados por IA a partir de PDFs/DOCX enviados pelo
próprio usuário, com repetição espaçada. Este README acompanha o projeto durante
todo o desenvolvimento — vou atualizá-lo a cada fase.

## Onde estamos: Fase 1 de 15

Nesta fase existe **só a arquitetura e a interface**, com dados fictícios
(`src/lib/mockData.ts`). Ainda não há Firebase, não há login de verdade e não há
geração por IA — isso vem nas próximas fases, uma de cada vez, sempre com o
projeto rodando entre uma fase e outra.

O que já dá para ver rodando:
- Todas as telas da lista de páginas do briefing (login, dashboard, biblioteca,
  deck, fluxo de criação com IA, estudo, cards difíceis, favoritos, estatísticas,
  perfil);
- Navegação completa entre elas;
- Sistema visual (cores, tipografia, componentes) já definitivo;
- Responsivo (barra inferior no celular, sidebar no desktop).

## FAÇA AGORA — rodar o projeto no seu computador

### 1. Instale o Node.js

Se você ainda não tem o Node instalado:

1. Acesse **https://nodejs.org**
2. Baixe a versão **LTS** (o botão da esquerda, recomendado para a maioria).
3. Instale normalmente, clicando em "Avançar" até o fim.
4. Para confirmar que funcionou, abra o **Terminal** (Mac) ou **Prompt de
   Comando/PowerShell** (Windows) e digite:
   ```
   node -v
   ```
   Deve aparecer um número de versão (ex: `v20.x.x`). Se aparecer erro, o Node
   não foi instalado corretamente — me avise.

### 2. Abra a pasta do projeto no terminal

Extraia o arquivo `.zip` do projeto em algum lugar do seu computador (ex:
Área de Trabalho). No terminal, navegue até essa pasta. Exemplo (Mac):
```
cd Desktop/flashcards-medicina
```

### 3. Instale as dependências

Ainda no terminal, dentro da pasta do projeto, rode:
```
npm install
```
Isso baixa todas as bibliotecas que o projeto usa (React, Tailwind, etc). Pode
demorar um ou dois minutos.

### 4. Rode o projeto

```
npm run dev
```

O terminal vai mostrar algo como:
```
Local:   http://localhost:5173/
```

Abra esse endereço no navegador. Você deve ver a tela de login.

### 5. Como saber se funcionou

- A tela de login aparece com um texto em itálico do lado direito (no
  desktop).
- Clicar em "Criar conta" leva para a tela de cadastro (ainda sem
  funcionar de verdade — isso é normal, é a Fase 2).
- Se você editar a URL do navegador para `http://localhost:5173/dashboard`,
  deve ver o painel principal com os decks de exemplo.

Se alguma dessas coisas não acontecer, me diga exatamente qual passo falhou e
o que apareceu no terminal ou no navegador.

## Próxima fase

**Fase 2 — Firebase + autenticação.** Vamos criar o projeto no Firebase
Console juntos, ativar Authentication (email/senha) e ligar as telas de
login/cadastro de verdade. Só avançamos quando você confirmar que a Fase 1
está rodando direitinho no seu computador.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- React Router
- Firebase (Authentication, Realtime Database, Storage) — a partir da Fase 2
- Netlify + Netlify Functions — a partir da Fase 2/7
