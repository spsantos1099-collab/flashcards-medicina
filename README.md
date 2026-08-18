# Fichário — estado atual do projeto

Cópia limpa do Fichário atualizada em 17/08/2026.

## O que já está funcionando

- React + Vite + TypeScript + Tailwind + React Router.
- Firebase Authentication por e-mail/senha.
- Firebase Realtime Database separado por UID.
- Criação, edição e exclusão de decks reais.
- Upload local de PDF e DOCX.
- Extração de texto de PDF página a página e de DOCX.
- Geração por IA: Básico, Cloze e Caso clínico.
- Dificuldade Fácil / Médio / Difícil.
- Geração em lotes, retentativas, deduplicação e revisão de casos clínicos.
- Fonte rastreável com documento/página/evidência quando disponível.
- Revisão antes de salvar: aprovar, rejeitar, editar, excluir, regenerar e criar manualmente.
- Cards persistidos nos decks.
- **Edição de cards já salvos diretamente no deck.**
- **Gerenciamento com seleção múltipla e exclusão de cards salvos.**
- Ao excluir cards salvos, reviews associados também são removidos.
- Modo de estudo com Errei / Difícil / Bom / Fácil.
- Repetição espaçada com FSRS.
- Fila diária, vencidos, novos e cards difíceis.
- Favoritos, busca global e filtros de estudo.
- Dashboard e estatísticas de desempenho.

## Modo Prova

O antigo acesso de **Pesquisar por tema** foi substituído na interface pelo **Modo Prova**.

Fluxo atual:

1. Selecionar deck de destino.
2. Enviar um PDF de prova com gabarito.
3. O Fichário identifica questões de múltipla escolha, alternativa marcada como `(CORRETA)`, dificuldade, resposta comentada, tema/subárea e prova de origem.
4. Questões repetidas são unificadas pelo código da questão.
5. Questões que dependem de figura, imagem, gráfico, traçado ou nomograma são descartadas automaticamente.
6. A usuária escolhe quais questões válidas quer transformar em flashcards. A resposta correta fica oculta nessa análise.
7. A usuária escolhe o formato: **Fiel à questão** (mantém enunciado/gabarito/comentário) ou **Memorização rápida** (Gemini apenas encurta o conteúdo para um card básico e atômico).
8. O gabarito do próprio PDF é soberano: mesmo no modo de memorização, a IA não decide nem troca qual alternativa é correta.
9. Os cards passam pela mesma tela de revisão antes de serem salvos.

## Pesquisar por tema — fora da interface

O código antigo de pesquisa médica foi preservado para possível retomada futura, mas a rota `/create/research` redireciona para `/create/exam` e não existe mais acesso pela interface.

Não retomar crawler, Google Search, MeSH, PubMed/OpenAlex ou ranking de fontes até decisão explícita de reabrir essa funcionalidade.

## Estrutura principal

```text
src/                      interface e lógica do aplicativo
netlify/functions/        funções server-side da IA e pesquisa preservada
firebase/                 regras do Realtime Database
public/                   arquivos públicos
package.json              dependências e comandos
package-lock.json         versões travadas das dependências
netlify.toml              configuração local/Netlify
vite.config.ts            configuração do Vite
.env.example              modelo de variáveis de ambiente, sem chaves reais
```

## Variável da Gemini

```text
FICHARIO_GEMINI_API_KEY
```

Ela é usada somente pelas Netlify Functions. Nunca criar `VITE_FICHARIO_GEMINI_API_KEY`.

## Arquivos não versionados no GitHub

O `.gitignore` mantém fora do repositório:

- `.env` e variantes locais — podem conter credenciais;
- `.netlify/` — estado/cache local da Netlify;
- `node_modules/` — recriado com `npm install`;
- `dist/` — recriado com `npm run build`;
- `*.tsbuildinfo` e arquivos gerados do `vite.config.ts`.

O arquivo `.env.example` fica no repositório apenas como modelo, sem valores reais.

## Como abrir no Windows

1. Extraia o ZIP.
2. Crie um `.env` local a partir de `.env.example` e preencha apenas no seu computador.
3. Abra um terminal na pasta.
4. Rode uma única vez:

```powershell
npm install
```

5. Confira:

```powershell
npm run build
```

6. Se terminar com `✓ built in ...`, rode:

```powershell
netlify dev
```

7. Abra `http://localhost:8888`.

## Deploy na Netlify

O repositório está preparado para deploy pela Netlify usando `netlify.toml`:

- comando de build: `npm run build`;
- pasta publicada: `dist`;
- Functions: `netlify/functions`;
- fallback SPA para o React Router.

As variáveis reais devem ser cadastradas no painel da Netlify e nunca commitadas no GitHub.


### Memorização rápida
- Assunto clínico inferido do enunciado, gabarito e comentário.
- Um único alvo de memória por card sempre que possível.

## Refinamento de interface e Perfil

- Perfil permite alterar nome e curso.
- Curso pode ser escolhido entre opções comuns da área da saúde ou informado manualmente.
- Senha pode ser alterada dentro do Perfil após confirmação da senha atual.
- Email permanece somente para leitura nesta etapa.
- Textos técnicos de infraestrutura foram retirados das telas principais.
- A tela inicial não usa mais emoji na saudação.
- Termos internos como Firebase, FSRS e nome do modelo Gemini não são mais exibidos no fluxo principal de criação e revisão.
