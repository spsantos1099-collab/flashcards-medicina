/* ==========================================================================
   COMPONENTS/CHARTS.JS
   Gráficos desenhados em SVG puro (sem bibliotecas externas), para
   respeitar a regra do projeto de usar apenas HTML/CSS/JS.
   ========================================================================== */

import { formatarMoeda } from "../js/utils.js";

/* --------------------------------------------------------------------
   GRÁFICO DE BARRAS — Receitas x Despesas por mês
   dados: [{ label: "Jan", receita: 1200, despesa: 800 }, ...]
   -------------------------------------------------------------------- */
export function criarGraficoBarras(container, dados) {
  if (!dados.length || dados.every((d) => d.receita === 0 && d.despesa === 0)) {
    container.innerHTML = '<p class="grafico-vazio">Sem lançamentos para mostrar ainda.</p>';
    return;
  }

  const largura = 640;
  const altura = 210;
  const margemBaixo = 28;
  const margemTopo = 12;
  const alturaUtil = altura - margemBaixo - margemTopo;
  const maiorValor = Math.max(...dados.map((d) => Math.max(d.receita, d.despesa)), 1);
  const larguraGrupo = largura / dados.length;
  const larguraBarra = Math.min(22, larguraGrupo / 3.2);

  const barras = dados.map((ponto, indice) => {
    const centroGrupo = larguraGrupo * indice + larguraGrupo / 2;
    const alturaReceita = (ponto.receita / maiorValor) * alturaUtil;
    const alturaDespesa = (ponto.despesa / maiorValor) * alturaUtil;

    return `
      <g>
        <rect x="${centroGrupo - larguraBarra - 3}" y="${margemTopo + alturaUtil - alturaReceita}"
              width="${larguraBarra}" height="${alturaReceita}" rx="3"
              fill="var(--cor-receita)">
          <title>Entradas ${ponto.label}: ${formatarMoeda(ponto.receita)}</title>
        </rect>
        <rect x="${centroGrupo + 3}" y="${margemTopo + alturaUtil - alturaDespesa}"
              width="${larguraBarra}" height="${alturaDespesa}" rx="3"
              fill="var(--cor-despesa)">
          <title>Saídas ${ponto.label}: ${formatarMoeda(ponto.despesa)}</title>
        </rect>
        <text x="${centroGrupo}" y="${altura - 6}" text-anchor="middle"
              fill="var(--cor-texto-suave)" font-size="11">
          ${ponto.label}
        </text>
      </g>
    `;
  }).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${largura} ${altura}" width="100%" role="img" aria-label="Gráfico de entradas recebidas e saídas pagas por mês">
      <line x1="0" y1="${margemTopo + alturaUtil}" x2="${largura}" y2="${margemTopo + alturaUtil}" stroke="var(--cor-borda)" />
      ${barras}
    </svg>
  `;
}

/* --------------------------------------------------------------------
   GRÁFICO DE ROSCA — Despesas por categoria
   dados: [{ label: "Moradia", valor: 500, cor: "#..." }, ...]
   -------------------------------------------------------------------- */
const PALETA_CATEGORIAS = [
  "#0D5C4C", "#2ED9B0", "#F5A623", "#3B82F6", "#E5484D",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1"
];

export function criarGraficoDonut(container, dados) {
  const total = dados.reduce((soma, item) => soma + item.valor, 0);

  if (!dados.length || total === 0) {
    container.innerHTML = '<p class="grafico-vazio">Sem despesas categorizadas este mês.</p>';
    return;
  }

  const raio = 70;
  const raioInterno = 44;
  const centro = 90;
  let anguloAtual = -90;

  const fatias = dados.map((item, indice) => {
    const fracao = item.valor / total;
    const anguloInicial = anguloAtual;
    const anguloFinal = anguloAtual + fracao * 360;
    anguloAtual = anguloFinal;

    const cor = item.cor || PALETA_CATEGORIAS[indice % PALETA_CATEGORIAS.length];
    const grandeArco = anguloFinal - anguloInicial > 180 ? 1 : 0;

    const pontoExterno = (angulo) => [
      centro + raio * Math.cos((angulo * Math.PI) / 180),
      centro + raio * Math.sin((angulo * Math.PI) / 180)
    ];

    const [x1, y1] = pontoExterno(anguloInicial);
    const [x2, y2] = pontoExterno(anguloFinal);

    return `
      <path d="M ${x1} ${y1} A ${raio} ${raio} 0 ${grandeArco} 1 ${x2} ${y2}"
            fill="none" stroke="${cor}" stroke-width="${raio - raioInterno}">
        <title>${item.label}: ${formatarMoeda(item.valor)} (${Math.round(fracao * 100)}%)</title>
      </path>
    `;
  }).join("");

  const legenda = dados.map((item, indice) => {
    const cor = item.cor || PALETA_CATEGORIAS[indice % PALETA_CATEGORIAS.length];
    const percentual = Math.round((item.valor / total) * 100);
    return `
      <div class="legenda-item">
        <span class="legenda-item__cor" style="background:${cor}"></span>
        <span class="legenda-item__label">${item.label}</span>
        <span class="legenda-item__valor numero">${percentual}%</span>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="grafico-donut">
      <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Gráfico de despesas por categoria">
        ${fatias}
      </svg>
      <div class="legenda">${legenda}</div>
    </div>
  `;
}

/* --------------------------------------------------------------------
   GRÁFICO DE LINHA — duas séries mensais
   dados: [{ label: "Jan", receita: 1200, despesa: 900 }, ...]
   -------------------------------------------------------------------- */
export function criarGraficoLinha(container, dados) {
  if (!dados.length || dados.every((d) => Number(d.receita || 0) === 0 && Number(d.despesa || 0) === 0)) {
    container.innerHTML = '<p class="grafico-vazio">Sem movimentação suficiente para o período.</p>';
    return;
  }

  const largura = 760;
  const altura = 250;
  const margem = { topo: 18, direita: 18, baixo: 34, esquerda: 18 };
  const larguraUtil = largura - margem.esquerda - margem.direita;
  const alturaUtil = altura - margem.topo - margem.baixo;
  const maior = Math.max(...dados.flatMap((d) => [Number(d.receita) || 0, Number(d.despesa) || 0]), 1);
  const passoX = dados.length > 1 ? larguraUtil / (dados.length - 1) : 0;

  function pontos(campo) {
    return dados.map((item, indice) => {
      const x = margem.esquerda + (dados.length === 1 ? larguraUtil / 2 : indice * passoX);
      const y = margem.topo + alturaUtil - ((Number(item[campo]) || 0) / maior) * alturaUtil;
      return { x, y, valor: Number(item[campo]) || 0, label: item.label };
    });
  }

  function polyline(lista, cor, nome) {
    const linha = lista.map((p) => `${p.x},${p.y}`).join(" ");
    const circulos = lista.map((p) => `
      <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${cor}">
        <title>${nome} ${p.label}: ${formatarMoeda(p.valor)}</title>
      </circle>`).join("");
    return `<polyline points="${linha}" fill="none" stroke="${cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${circulos}`;
  }

  const entradas = pontos("receita");
  const saidas = pontos("despesa");
  const labels = dados.map((item, indice) => {
    const x = margem.esquerda + (dados.length === 1 ? larguraUtil / 2 : indice * passoX);
    return `<text x="${x}" y="${altura - 8}" text-anchor="middle" fill="var(--cor-texto-suave)" font-size="10">${item.label}</text>`;
  }).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${largura} ${altura}" width="100%" role="img" aria-label="Evolução de entradas e gastos no período">
      <line x1="${margem.esquerda}" y1="${margem.topo + alturaUtil}" x2="${largura - margem.direita}" y2="${margem.topo + alturaUtil}" stroke="var(--cor-borda)"/>
      ${polyline(entradas, "var(--cor-receita)", "Entradas")}
      ${polyline(saidas, "var(--cor-despesa)", "Gastos")}
      ${labels}
    </svg>`;
}

/* --------------------------------------------------------------------
   BARRAS HORIZONTAIS — ranking por categoria
   -------------------------------------------------------------------- */
export function criarGraficoBarrasHorizontais(container, dados, { limite = 8, tipo = "despesa" } = {}) {
  const lista = dados.filter((item) => Number(item.valor) > 0).slice(0, limite);
  if (!lista.length) {
    container.innerHTML = '<p class="grafico-vazio">Sem categorias para mostrar neste período.</p>';
    return;
  }
  const maior = Math.max(...lista.map((item) => Number(item.valor) || 0), 1);
  const cor = tipo === "receita" ? "var(--cor-receita)" : "var(--cor-despesa)";
  container.innerHTML = `<div class="grafico-ranking">${lista.map((item) => {
    const percentual = Math.max(2, ((Number(item.valor) || 0) / maior) * 100);
    return `
      <div class="grafico-ranking__item">
        <div class="grafico-ranking__rotulo"><span>${item.label}</span><strong class="numero">${formatarMoeda(item.valor)}</strong></div>
        <div class="grafico-ranking__trilho"><i style="width:${percentual}%;background:${cor}"></i></div>
      </div>`;
  }).join("")}</div>`;
}
