# Fase 7.8 — geração assíncrona e estável

Esta versão altera a arquitetura da geração de flashcards para reduzir falhas, timeouts e oscilações da Gemini API.

## Mudança principal

A geração deixou de ser coordenada pelo navegador em dezenas de requisições síncronas. Agora o navegador inicia um único **Netlify Background Function**, recebe o progresso pelo Firebase Realtime Database e aguarda o resultado.

- Básico/Cloze: `gemini-3.5-flash-lite`
- Caso clínico e segundo revisor: `gemini-3.6-flash`
- Fallback clínico: `gemini-3.5-flash`

O texto original do PDF/DOCX continua não sendo salvo no Firebase. O job temporário guarda somente estado/progresso e, ao terminar, os cards derivados; o frontend remove o job após receber o resultado.

## Por que isso corrige a instabilidade

Na versão anterior, 10 casos clínicos podiam exigir 8 chamadas Gemini já na primeira rodada (4 gerações + 4 validações), além de retries e rodadas de reposição. Nesta versão, 10 casos clínicos normalmente exigem 2 chamadas (1 geração ampla + 1 validação), com uma reposição adicional somente se necessário.

O processamento ocorre em background, portanto não depende do limite de uma Function síncrona nem da conexão do celular permanecer ativa durante todo o raciocínio da IA.

## Configuração externa

Nenhuma nova variável é obrigatória. `GEMINI_API_KEY` continua sendo suficiente.

Não é necessário alterar as regras do Realtime Database: os jobs temporários ficam aninhados dentro de `documents/{uid}/{documentId}/generationJobs`, já coberto pelas regras privadas do usuário.
