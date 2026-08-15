# Fichário — Fase 7.8.1

Refinamento final de qualidade da geração. A arquitetura assíncrona da Fase 7.8 foi preservada.

## Ajustes desta versão

- deduplicação semântica mais rígida entre Básico, Cloze e Caso clínico;
- `learningObjective` orientado a uma forma canônica e independente do tipo de card;
- Cloze rejeita lacunas banais e escalas de 3+ categorias parcialmente escondidas;
- português do Brasil reforçado no prompt e limpeza de pequenos vazamentos terminológicos;
- normalização de apresentação para ICFEr/ICFEp, NT-proBNP, sacubitril/valsartana e m²;
- rejeição de qualificadores mais fortes que a fonte, como “contraindicação absoluta” quando a evidência não sustenta esse termo;
- calibração explícita de dificuldade para fácil/média/difícil;
- casos clínicos difíceis não podem entregar no enunciado a pontuação, classe ou estágio que o estudante deveria calcular/reconhecer;
- distinção entre dado de entrada e resposta escondida: uma classe NYHA pode ser fornecida quando a pergunta testa a conduta posterior;
- preservação da diferença entre recomendações separadas (ex.: orientação hídrica e orientação de sal);
- segunda revisão clínica também avalia dificuldade, pistas que entregam a resposta, terminologia e força das afirmações;
- uma rodada extra de reposição foi habilitada para compensar os filtros mais rigorosos sem mudar o pipeline assíncrono.

## O que não mudou

- PDF/DOCX continua sendo lido localmente no navegador;
- o conteúdo bruto do documento não é salvo no Firebase;
- geração continua em Background Function;
- Básico/Cloze usam o modelo rápido e Casos clínicos usam o modelo clínico + segundo revisor;
- referências por página/trecho continuam obrigatórias;
- a tela de revisão continua exigindo ação humana antes da futura persistência dos cards.
