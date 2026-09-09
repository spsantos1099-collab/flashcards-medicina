/* ==========================================================================\n   CALCULOS.JS\n   Regras financeiras centrais do sistema. Mantém Dashboard e Cartões usando\n   a mesma lógica e evita somar duas vezes pagamentos, faturas e acertos.\n   ========================================================================== */

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

export function chavePessoa(nome) {
  return String(nome || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function mesDaData(data) {
  return typeof data === "string" && data.length >= 7 ? data.slice(0, 7) : "";
}

export function faturaManualDoMes(faturasManuais = [], cartaoId, mes) {
  return faturasManuais.find((fatura) =>
    fatura.cartaoId === cartaoId && fatura.mesReferencia === mes
  ) || null;
}

export function parcelasDoCartaoMes(parcelas = [], cartaoId, mes) {
  return parcelas.filter((parcela) =>
    parcela.cartaoId === cartaoId && parcela.mesFatura === mes
  );
}

export function totalFaturaCartao({ parcelas = [], faturasManuais = [] }, cartaoId, mes) {
  const manual = faturaManualDoMes(faturasManuais, cartaoId, mes);
  if (manual) return numero(manual.valor);
  return parcelasDoCartaoMes(parcelas, cartaoId, mes)
    .reduce((soma, parcela) => soma + numero(parcela.valor), 0);
}

export function totalPagoLegadoFatura({ parcelas = [], faturasManuais = [] }, cartaoId, mes) {
  const total = totalFaturaCartao({ parcelas, faturasManuais }, cartaoId, mes);
  const manual = faturaManualDoMes(faturasManuais, cartaoId, mes);
  if (manual) return manual.pago ? total : 0;

  const pago = parcelasDoCartaoMes(parcelas, cartaoId, mes)
    .filter((parcela) => parcela.pago)
    .reduce((soma, parcela) => soma + numero(parcela.valor), 0);

  return Math.min(total, pago);
}

export function pagamentosRegistradosFatura(pagamentosFaturas = [], cartaoId, mes) {
  return pagamentosFaturas
    .filter((pagamento) => pagamento.cartaoId === cartaoId && pagamento.mesReferencia === mes)
    .reduce((soma, pagamento) => soma + numero(pagamento.valor), 0);
}

export function totalPagoFaturaPropria(dados, cartaoId, mes) {
  const total = totalFaturaCartao(dados, cartaoId, mes);
  const registrado = pagamentosRegistradosFatura(dados.pagamentosFaturas || [], cartaoId, mes);
  if (registrado > 0) return Math.min(total, registrado);
  return totalPagoLegadoFatura(dados, cartaoId, mes);
}

export function restanteFaturaPropria(dados, cartaoId, mes) {
  return Math.max(0, totalFaturaCartao(dados, cartaoId, mes) - totalPagoFaturaPropria(dados, cartaoId, mes));
}

export function nomesPessoasDoMes(dados, mes) {
  const mapa = new Map();
  const cartoes = dados.cartoes || [];
  const despesas = dados.despesas || [];
  const acertos = dados.acertosPessoas || [];

  cartoes.filter((cartao) => cartao.tipo === "terceiro").forEach((cartao) => {
    const nome = String(cartao.titular || "Outra pessoa").trim();
    mapa.set(chavePessoa(nome), nome);
  });

  despesas.forEach((despesa) => {
    if (mesDaData(despesa.data) !== mes || !despesa.pessoaRelacionada) return;
    const nome = String(despesa.pessoaRelacionada).trim();
    mapa.set(chavePessoa(nome), nome);
  });

  acertos.forEach((acerto) => {
    if (acerto.mesReferencia !== mes || !acerto.pessoa) return;
    const nome = String(acerto.pessoa).trim();
    mapa.set(chavePessoa(nome), nome);
  });

  return [...mapa.values()];
}

export function resumoPessoaMes(dados, nomePessoa, mes) {
  const chave = chavePessoa(nomePessoa);
  const cartoes = dados.cartoes || [];
  const despesas = dados.despesas || [];
  const acertos = dados.acertosPessoas || [];

  const cartoesPessoa = cartoes.filter((cartao) =>
    cartao.tipo === "terceiro" && chavePessoa(cartao.titular || "Outra pessoa") === chave
  );

  const despesasPessoa = despesas.filter((despesa) =>
    mesDaData(despesa.data) === mes && chavePessoa(despesa.pessoaRelacionada) === chave
  );

  const totalCartoes = cartoesPessoa.reduce(
    (soma, cartao) => soma + totalFaturaCartao(dados, cartao.id, mes), 0
  );
  const totalDespesas = despesasPessoa.reduce((soma, despesa) => soma + numero(despesa.valor), 0);
  const totalMes = totalCartoes + totalDespesas;

  const pagamentosRegistrados = acertos
    .filter((acerto) => acerto.mesReferencia === mes && chavePessoa(acerto.pessoa) === chave)
    .reduce((soma, acerto) => soma + numero(acerto.valor), 0);

  // Compatibilidade com dados anteriores ao histórico de acertos. Assim que
  // existe um acerto novo para a pessoa/mês, ele vira a fonte de verdade e os
  // antigos flags "pago" deixam de ser somados novamente.
  const pagoLegadoCartoes = cartoesPessoa.reduce(
    (soma, cartao) => soma + totalPagoLegadoFatura(dados, cartao.id, mes), 0
  );
  const pagoLegadoDespesas = despesasPessoa
    .filter((despesa) => despesa.status === "pago")
    .reduce((soma, despesa) => soma + numero(despesa.valor), 0);
  const pagoLegado = pagoLegadoCartoes + pagoLegadoDespesas;

  const jaPago = Math.min(totalMes, pagamentosRegistrados > 0 ? pagamentosRegistrados : pagoLegado);

  return {
    pessoa: nomePessoa,
    cartoes: cartoesPessoa,
    despesas: despesasPessoa,
    totalCartoes,
    totalDespesas,
    totalMes,
    pagamentosRegistrados,
    pagoLegado,
    jaPago,
    restante: Math.max(0, totalMes - jaPago)
  };
}

export function totalFaturasMes(dados, mes) {
  return (dados.cartoes || []).reduce(
    (soma, cartao) => soma + totalFaturaCartao(dados, cartao.id, mes), 0
  );
}

export function totalDespesasMes(dados, mes) {
  return (dados.despesas || [])
    .filter((despesa) => mesDaData(despesa.data) === mes)
    .reduce((soma, despesa) => soma + numero(despesa.valor), 0);
}

export function totalSaidasPagasMes(dados, mes) {
  const despesas = dados.despesas || [];
  const cartoes = dados.cartoes || [];

  // Despesas comuns pagas. As vinculadas a alguém entram pelo bloco de
  // acerto com a pessoa para não serem debitadas duas vezes.
  const despesasComunsPagas = despesas
    .filter((despesa) => mesDaData(despesa.data) === mes)
    .filter((despesa) => !String(despesa.pessoaRelacionada || "").trim())
    .filter((despesa) => despesa.status === "pago")
    .reduce((soma, despesa) => soma + numero(despesa.valor), 0);

  const cartoesPropriosPagos = cartoes
    .filter((cartao) => cartao.tipo !== "terceiro")
    .reduce((soma, cartao) => soma + totalPagoFaturaPropria(dados, cartao.id, mes), 0);

  const pessoasPagas = nomesPessoasDoMes(dados, mes)
    .reduce((soma, pessoa) => soma + resumoPessoaMes(dados, pessoa, mes).jaPago, 0);

  return despesasComunsPagas + cartoesPropriosPagos + pessoasPagas;
}

export function mesesComMovimentacao(dados) {
  const meses = new Set();
  (dados.despesas || []).forEach((item) => { const mes = mesDaData(item.data); if (mes) meses.add(mes); });
  (dados.parcelas || []).forEach((item) => { if (item.mesFatura) meses.add(item.mesFatura); });
  (dados.faturasManuais || []).forEach((item) => { if (item.mesReferencia) meses.add(item.mesReferencia); });
  (dados.acertosPessoas || []).forEach((item) => { if (item.mesReferencia) meses.add(item.mesReferencia); });
  (dados.pagamentosFaturas || []).forEach((item) => { if (item.mesReferencia) meses.add(item.mesReferencia); });
  return [...meses].sort();
}

export function calcularSaldoAtual(dados, mes) {
  // Neste sistema, “Saldo atual” representa o caixa realizado do mês em
  // exibição: o que já entrou menos o que já saiu. Isso evita que a simples
  // regularização de meses antigos altere o saldo do mês atual.
  const totalRecebido = (dados.receitas || [])
    .filter((receita) => mesDaData(receita.data) === mes)
    .filter((receita) => receita.status === "recebido")
    .reduce((soma, receita) => soma + numero(receita.valor), 0);

  return totalRecebido - totalSaidasPagasMes(dados, mes);
}

export function resumoFinanceiroMes(dados, mes) {
  const receitasDoMes = (dados.receitas || []).filter((receita) => mesDaData(receita.data) === mes);
  const despesasDoMes = (dados.despesas || []).filter((despesa) => mesDaData(despesa.data) === mes);

  const receitasPrevistas = receitasDoMes.reduce((soma, receita) => soma + numero(receita.valor), 0);
  const receitasRecebidas = receitasDoMes
    .filter((receita) => receita.status === "recebido")
    .reduce((soma, receita) => soma + numero(receita.valor), 0);

  const despesas = despesasDoMes.reduce((soma, despesa) => soma + numero(despesa.valor), 0);
  const faturas = totalFaturasMes(dados, mes);
  const totalComprometido = despesas + faturas;
  const pago = totalSaidasPagasMes(dados, mes);

  return {
    receitasPrevistas,
    receitasRecebidas,
    aReceber: Math.max(0, receitasPrevistas - receitasRecebidas),
    despesas,
    faturas,
    totalComprometido,
    pago,
    aPagar: Math.max(0, totalComprometido - pago),
    resultadoPrevisto: receitasPrevistas - totalComprometido,
    saldoAtual: calcularSaldoAtual(dados, mes)
  };
}
