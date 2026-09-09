/* ==========================================================================\n   COMPONENTS/RELATORIOS.JS\n   Consolidação de dados usada pela tela de Relatórios e exportações.\n   ========================================================================== */

import { somarMeses } from "../js/utils.js";
import { resumoFinanceiroMes, faturaManualDoMes } from "../js/calculos.js";

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

export function mesesEntre(inicio, fim) {
  if (!inicio || !fim || inicio > fim) return [];
  const meses = [];
  let atual = inicio;
  let seguranca = 0;
  while (atual <= fim && seguranca < 240) {
    meses.push(atual);
    atual = somarMeses(atual, 1);
    seguranca += 1;
  }
  return meses;
}

export function resumoMensalRelatorio(dados, meses) {
  return meses.map((mes) => ({ mes, ...resumoFinanceiroMes(dados, mes) }));
}

export function agruparPorAno(resumosMensais) {
  const mapa = new Map();
  resumosMensais.forEach((item) => {
    const ano = item.mes.slice(0, 4);
    if (!mapa.has(ano)) {
      mapa.set(ano, {
        ano,
        receitasPrevistas: 0,
        receitasRecebidas: 0,
        despesas: 0,
        faturas: 0,
        totalComprometido: 0,
        pago: 0
      });
    }
    const alvo = mapa.get(ano);
    Object.keys(alvo).forEach((chave) => {
      if (chave !== "ano") alvo[chave] += numero(item[chave]);
    });
  });
  return [...mapa.values()].map((item) => ({
    ...item,
    resultado: item.receitasRecebidas - item.pago,
    resultadoPrevisto: item.receitasPrevistas - item.totalComprometido
  }));
}

function adicionarNoMapa(mapa, chave, valor) {
  const nome = String(chave || "Sem categoria").trim() || "Sem categoria";
  mapa.set(nome, (mapa.get(nome) || 0) + numero(valor));
}

export function categoriasDespesasPeriodo(dados, meses) {
  const conjuntoMeses = new Set(meses);
  const mapa = new Map();

  (dados.despesas || []).forEach((despesa) => {
    const mes = String(despesa.data || "").slice(0, 7);
    if (conjuntoMeses.has(mes)) adicionarNoMapa(mapa, despesa.categoria, despesa.valor);
  });

  (dados.cartoes || []).forEach((cartao) => {
    meses.forEach((mes) => {
      const manual = faturaManualDoMes(dados.faturasManuais || [], cartao.id, mes);
      if (manual) {
        adicionarNoMapa(mapa, "Faturas sem detalhamento", manual.valor);
        return;
      }
      (dados.parcelas || [])
        .filter((parcela) => parcela.cartaoId === cartao.id && parcela.mesFatura === mes)
        .forEach((parcela) => adicionarNoMapa(mapa, parcela.categoria, parcela.valor));
    });
  });

  return [...mapa.entries()]
    .map(([label, valor]) => ({ label, valor }))
    .sort((a, b) => b.valor - a.valor);
}

export function categoriasReceitasPeriodo(dados, meses) {
  const conjuntoMeses = new Set(meses);
  const mapa = new Map();
  (dados.receitas || []).forEach((receita) => {
    const mes = String(receita.data || "").slice(0, 7);
    if (!conjuntoMeses.has(mes)) return;
    adicionarNoMapa(mapa, receita.categoria, receita.valor);
  });
  return [...mapa.entries()]
    .map(([label, valor]) => ({ label, valor }))
    .sort((a, b) => b.valor - a.valor);
}

export function lancamentosPeriodo(dados, meses) {
  const conjuntoMeses = new Set(meses);
  const linhas = [];

  (dados.receitas || []).forEach((item) => {
    if (!conjuntoMeses.has(String(item.data || "").slice(0, 7))) return;
    linhas.push({
      tipo: "Receita",
      descricao: item.descricao || "Receita",
      categoria: item.categoria || "Sem categoria",
      data: item.data || "",
      status: item.status || "",
      origem: item.contaBancaria || "",
      valor: numero(item.valor)
    });
  });

  (dados.despesas || []).forEach((item) => {
    if (!conjuntoMeses.has(String(item.data || "").slice(0, 7))) return;
    linhas.push({
      tipo: "Despesa",
      descricao: item.descricao || "Despesa",
      categoria: item.categoria || "Sem categoria",
      data: item.data || "",
      status: item.status || "",
      origem: item.pessoaRelacionada ? `Vinculada a ${item.pessoaRelacionada}` : (item.contaBancaria || ""),
      valor: numero(item.valor)
    });
  });

  (dados.cartoes || []).forEach((cartao) => {
    meses.forEach((mes) => {
      const manual = faturaManualDoMes(dados.faturasManuais || [], cartao.id, mes);
      if (manual) {
        linhas.push({
          tipo: "Fatura",
          descricao: `Fatura ${cartao.nome || "Cartão"}`,
          categoria: "Fatura informada manualmente",
          data: `${mes}-01`,
          status: manual.pago ? "pago" : "",
          origem: cartao.tipo === "terceiro" ? (cartao.titular || "Terceiro") : "Cartão próprio",
          valor: numero(manual.valor)
        });
        return;
      }

      (dados.parcelas || [])
        .filter((parcela) => parcela.cartaoId === cartao.id && parcela.mesFatura === mes)
        .forEach((parcela) => {
          linhas.push({
            tipo: "Cartão",
            descricao: parcela.descricao || "Compra no cartão",
            categoria: parcela.categoria || "Sem categoria",
            data: parcela.dataVencimento || `${mes}-01`,
            status: parcela.pago ? "pago" : "pendente",
            origem: cartao.nome || "Cartão",
            valor: numero(parcela.valor)
          });
        });
    });
  });

  return linhas.sort((a, b) => String(a.data).localeCompare(String(b.data)) || a.tipo.localeCompare(b.tipo));
}

export function destaquesPeriodo(dados, meses) {
  const linhas = lancamentosPeriodo(dados, meses);
  const receitas = linhas.filter((item) => item.tipo === "Receita");
  const gastos = linhas.filter((item) => item.tipo !== "Receita");
  const maiorReceita = receitas.sort((a, b) => b.valor - a.valor)[0] || null;
  const maiorGasto = gastos.sort((a, b) => b.valor - a.valor)[0] || null;
  const categoriasDespesas = categoriasDespesasPeriodo(dados, meses);
  const categoriasReceitas = categoriasReceitasPeriodo(dados, meses);
  return {
    maiorReceita,
    maiorGasto,
    categoriaMaiorGasto: categoriasDespesas[0] || null,
    categoriaMaiorReceita: categoriasReceitas[0] || null
  };
}
