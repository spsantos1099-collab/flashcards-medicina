/* ==========================================================================
   COMPONENTS/CARDS.JS
   Renderiza os cards de resumo do Dashboard. Cada card é um objeto:
   { titulo, valor, tipo, subtitulo }
   tipo: "neutro" | "receita" | "despesa" | "alerta"
   ========================================================================== */

import { formatarMoeda } from "../js/utils.js";

const CORES_POR_TIPO = {
  neutro: "var(--cor-texto)",
  receita: "var(--cor-receita)",
  despesa: "var(--cor-despesa)",
  alerta: "var(--cor-alerta)"
};

export function renderizarCards(container, cards) {
  container.innerHTML = "";

  cards.forEach((card) => {
    const elemento = document.createElement("div");
    elemento.className = "card card-resumo";

    const valorFormatado = card.formato === "numero"
      ? String(card.valor)
      : (typeof card.valor === "number" ? formatarMoeda(card.valor) : card.valor);

    elemento.innerHTML = `
      <span class="card-resumo__titulo">${card.titulo}</span>
      <span class="card-resumo__valor numero" style="color: ${CORES_POR_TIPO[card.tipo] || CORES_POR_TIPO.neutro}">
        ${valorFormatado}
      </span>
      ${card.subtitulo ? `<span class="card-resumo__subtitulo">${card.subtitulo}</span>` : ""}
    `;

    container.appendChild(elemento);
  });
}
