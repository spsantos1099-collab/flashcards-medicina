/* ==========================================================================\n   COMPONENTS/METAS.JS\n   Regras puras das metas financeiras.\n   ========================================================================== */

export function movimentosDaMeta(meta = {}) {
  const objeto = meta.movimentos || {};
  return Object.entries(objeto).map(([id, dados]) => ({ id, ...dados }));
}

export function valorAtualMeta(meta = {}) {
  const base = Number(meta.valorInicial) || 0;
  return Math.max(0, movimentosDaMeta(meta).reduce(
    (total, movimento) => total + (Number(movimento.valor) || 0),
    base
  ));
}

export function percentualMeta(meta = {}) {
  const alvo = Number(meta.valorMeta) || 0;
  if (alvo <= 0) return 0;
  return Math.min(100, Math.max(0, (valorAtualMeta(meta) / alvo) * 100));
}

export function faltaMeta(meta = {}) {
  return Math.max(0, (Number(meta.valorMeta) || 0) - valorAtualMeta(meta));
}

function diferencaMeses(dataInicial, dataFinal) {
  const inicio = new Date(`${dataInicial}T00:00:00`);
  const fim = new Date(`${dataFinal}T00:00:00`);
  const dias = Math.max(1, (fim - inicio) / 86400000);
  return Math.max(1, dias / 30.4375);
}

export function previsaoMeta(meta = {}) {
  const faltante = faltaMeta(meta);
  if (faltante <= 0) return { texto: "Meta concluída", tipo: "concluida" };

  const movimentosPositivos = movimentosDaMeta(meta)
    .filter((movimento) => (Number(movimento.valor) || 0) > 0 && movimento.data)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));

  if (movimentosPositivos.length >= 2) {
    const totalAportes = movimentosPositivos.reduce((soma, item) => soma + Number(item.valor), 0);
    const mesesObservados = diferencaMeses(
      movimentosPositivos[0].data,
      movimentosPositivos[movimentosPositivos.length - 1].data
    );
    const mediaMensal = totalAportes / mesesObservados;

    if (mediaMensal > 0) {
      const mesesRestantes = Math.max(1, Math.ceil(faltante / mediaMensal));
      const data = new Date();
      data.setMonth(data.getMonth() + mesesRestantes);
      const textoData = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(data);
      return {
        texto: `No ritmo atual: ${textoData}`,
        tipo: "estimativa",
        mediaMensal
      };
    }
  }

  if (meta.dataLimite) {
    const prazo = new Intl.DateTimeFormat("pt-BR").format(new Date(`${meta.dataLimite}T00:00:00`));
    return { texto: `Prazo definido: ${prazo}`, tipo: "prazo" };
  }

  return { texto: "Previsão após novos aportes", tipo: "sem-historico" };
}
