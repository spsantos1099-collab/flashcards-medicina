# Controle Financeiro

Sistema pessoal de controle financeiro feito com **HTML, CSS e JavaScript puro**, usando **Firebase Authentication + Realtime Database** e publicação pela **Netlify** a partir do GitHub.

## Estado atual

Concluídas até aqui:

1. Estrutura do projeto
2. Firebase Realtime Database
3. Login com Google e e-mail/senha
4. Dashboard
5. Receitas
6. Despesas
7. Cartões, faturas, parcelamento e assinaturas
8. Calendário financeiro
9. Metas financeiras
10. Relatórios

Além dessas etapas, esta versão contém uma revisão de usabilidade do Dashboard, Cartões, pagamentos, tema e perfil.

## Estrutura

```text
controle-financeiro/
├── index.html
├── database.rules.json
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── calculos.js
│   ├── config.js
│   ├── firebase.js
│   ├── theme-init.js
│   └── utils.js
├── components/
│   ├── calendario.js
│   ├── metas.js
│   ├── relatorios.js
│   ├── cards.js
│   ├── cartoes.js
│   ├── charts.js
│   └── modal.js
└── pages/
    ├── dashboard.html
    ├── receitas.html
    ├── despesas.html
    ├── cartoes.html
    ├── calendario.html
    ├── metas.html
    ├── relatorios.html
    └── configuracoes.html
```

## Banco de dados

Todos os dados ficam em:

```text
usuarios/{uid}/...
```

As regras de `database.rules.json` permitem que cada usuário autenticado leia e altere somente a própria árvore.

Coleções/áreas utilizadas atualmente:

- `receitas`
- `despesas`
- `cartoes`
- `compras`
- `parcelas`
- `faturasManuais`
- `acertosPessoas`
- `pagamentosFaturas`
- `configuracoes/preferencias`
- `perfil/principal`
- `metas`

## Regra financeira do Dashboard

O Dashboard usa `js/calculos.js` como fonte única de cálculo para evitar duplicidade.

- **Recebido este mês:** receitas do mês com status `recebido`.
- **Pago este mês:** despesas comuns pagas + faturas próprias pagas + pagamentos/acertos com terceiros.
- **Saldo atual:** recebido no mês − pago no mês.
- **Despesas:** lançamentos da tela Despesas no mês.
- **Faturas:** total oficial das faturas do mês. Se houver um total manual, ele substitui a soma das compras detalhadas daquele cartão/mês.
- **Total do mês:** despesas + faturas.
- **Acertos com pessoas não são uma nova despesa:** eles registram o pagamento das obrigações já contabilizadas, evitando somar o mesmo valor duas vezes.

Regularizar um pagamento de um mês antigo altera aquele mês, mas não muda o “Saldo atual” do mês corrente.

## Cartões de terceiros e acertos

Cartões de outras pessoas são mostrados **mês a mês**, sem somar parcelas futuras ou assinaturas como se fossem uma dívida atual inteira.

É possível:

- informar somente o total da fatura;
- lançar compras detalhadas quando for útil;
- registrar pagamento parcial;
- marcar a fatura inteira como paga;
- vincular despesas comuns a uma pessoa (ex.: `Energia → Mãe`);
- visualizar o acerto mensal consolidado da pessoa;
- registrar pagamentos parciais ou marcar todo o acerto do mês como pago.

O sistema preserva pagamentos antigos que já estavam marcados antes da criação do histórico de pagamentos, sem contá-los duas vezes.

## Faturas compactas

As faturas ficam recolhidas por padrão. O cabeçalho mostra o essencial; os lançamentos aparecem ao clicar em **Ver detalhes**. Para faturas muito grandes, são mostrados poucos registros por vez com **Mostrar mais**, evitando uma página interminável.

## Assinaturas

Compras recorrentes mantêm um horizonte de cobranças futuras e usam um identificador único por assinatura/mês para evitar duplicidades. Também é possível remover somente uma cobrança mensal sem apagar toda a assinatura.

## Tema e aparência

A interface usa a tipografia **Geist**, com números tabulares para valores financeiros.

Em **Configurações → Aparência**, o usuário escolhe:

- Claro
- Escuro
- Seguir sistema

A preferência é salva localmente e em `configuracoes/preferencias`. O arquivo `js/theme-init.js` aplica o tema antes do CSS ser desenhado para evitar a piscada branca ao trocar de página.

## Publicação

O projeto não tem etapa de build. No GitHub, `index.html`, `css/`, `js/`, `components/` e `pages/` devem permanecer na raiz do repositório. Na Netlify, o diretório de publicação é a raiz (`.` ou vazio, conforme a interface).


## Metas

A área de Metas permite criar objetivos, informar valor inicial, prazo opcional, registrar aportes ou retiradas e acompanhar percentual, valor restante e previsão de conclusão baseada no histórico de aportes.

## Relatórios

A área de Relatórios permite selecionar um período, comparar meses e anos, analisar categorias, maiores receitas/gastos e exportar os lançamentos em CSV, Excel (.xls) ou usar a impressão do navegador para salvar em PDF.

## Perfil

Em Configurações, o usuário pode informar nome, sobrenome e nome de exibição. O sistema usa essa identidade no cabeçalho das páginas. Quando a conta Google possui foto de perfil, ela é usada na área de configurações; caso contrário, são exibidas iniciais.
