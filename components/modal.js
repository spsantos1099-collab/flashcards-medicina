/* ==========================================================================
   COMPONENTS/MODAL.JS
   Modal genérico reutilizável em qualquer página. Duas formas de uso:

   1) abrirModal(htmlDoConteudo) — para formulários (Receitas, Despesas...)
   2) confirmarExclusao("Excluir esta receita?") — retorna uma Promise<boolean>
   ========================================================================== */

let elementoModalAtual = null;

export function abrirModal(conteudoHtml, { aoFechar } = {}) {
  fecharModal();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal-caixa">${conteudoHtml}</div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  elementoModalAtual = overlay;

  // Fecha ao clicar fora da caixa, ou no botão [data-fechar-modal]
  overlay.addEventListener("click", (evento) => {
    if (evento.target === overlay || evento.target.closest("[data-fechar-modal]")) {
      fecharModal();
      aoFechar?.();
    }
  });

  function aoPressionarTecla(evento) {
    if (evento.key === "Escape") {
      fecharModal();
      aoFechar?.();
    }
  }
  document.addEventListener("keydown", aoPressionarTecla);
  overlay.dataset.temListenerTeclado = "true";
  overlay._removerListenerTeclado = () => document.removeEventListener("keydown", aoPressionarTecla);

  // Foca o primeiro campo, se houver, para agilizar o preenchimento
  requestAnimationFrame(() => {
    overlay.querySelector("input, select, textarea, button")?.focus();
  });

  return overlay;
}

export function fecharModal() {
  if (!elementoModalAtual) return;
  elementoModalAtual._removerListenerTeclado?.();
  elementoModalAtual.remove();
  elementoModalAtual = null;
  document.body.style.overflow = "";
}

export function confirmarExclusao(mensagem = "Tem certeza que deseja excluir este item?") {
  return new Promise((resolve) => {
    const overlay = abrirModal(`
      <h3 class="modal-titulo">Confirmar exclusão</h3>
      <p class="modal-texto">${mensagem}</p>
      <div class="modal-acoes">
        <button class="botao-secundario" data-fechar-modal type="button">Cancelar</button>
        <button class="botao-perigo" id="botaoConfirmarExclusao" type="button">Excluir</button>
      </div>
    `, { aoFechar: () => resolve(false) });

    overlay.querySelector("#botaoConfirmarExclusao").addEventListener("click", () => {
      fecharModal();
      resolve(true);
    });
  });
}

/* --------------------------------------------------------------------
   CONFIRMAÇÃO GENÉRICA (para ações que NÃO são exclusão, como
   "marcar fatura como paga"). Retorna uma Promise<boolean>.
   -------------------------------------------------------------------- */
export function confirmarAcao(mensagem, { titulo = "Confirmar", rotuloConfirmar = "Confirmar" } = {}) {
  return new Promise((resolve) => {
    const overlay = abrirModal(`
      <h3 class="modal-titulo">${titulo}</h3>
      <p class="modal-texto">${mensagem}</p>
      <div class="modal-acoes">
        <button class="botao-secundario" data-fechar-modal type="button">Cancelar</button>
        <button class="botao-primario" style="width:auto;" id="botaoConfirmarAcao" type="button">${rotuloConfirmar}</button>
      </div>
    `, { aoFechar: () => resolve(false) });

    overlay.querySelector("#botaoConfirmarAcao").addEventListener("click", () => {
      fecharModal();
      resolve(true);
    });
  });
}
