/* ==========================================================================\n   THEME-INIT.JS\n   Executado antes do CSS para que a página já nasça no tema correto. Isso\n   evita o clarão branco ao navegar entre páginas no modo escuro.\n   ========================================================================== */
(function () {
  const CHAVE = "controleFinanceiro:temaPreferencia";
  const CHAVE_ANTIGA = "controleFinanceiro:tema";
  const opcoes = new Set(["sistema", "claro", "escuro"]);
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function normalizar(preferencia) {
    return opcoes.has(preferencia) ? preferencia : "sistema";
  }

  function temaReal(preferencia) {
    if (preferencia === "claro" || preferencia === "escuro") return preferencia;
    return media.matches ? "escuro" : "claro";
  }

  function aplicarPreferencia(preferencia, persistir = true) {
    const normalizada = normalizar(preferencia);
    const tema = temaReal(normalizada);

    document.documentElement.setAttribute("data-tema", tema);
    document.documentElement.style.colorScheme = tema === "escuro" ? "dark" : "light";

    if (persistir) {
      try {
        localStorage.setItem(CHAVE, normalizada);
        localStorage.removeItem(CHAVE_ANTIGA);
      } catch (_) {}
    }

    window.dispatchEvent(new CustomEvent("controle-tema-alterado", {
      detail: { preferencia: normalizada, tema }
    }));

    return tema;
  }

  let preferencia = "sistema";
  try {
    const salva = localStorage.getItem(CHAVE);
    const antiga = localStorage.getItem(CHAVE_ANTIGA);
    preferencia = normalizar(salva || antiga || "sistema");
  } catch (_) {}

  aplicarPreferencia(preferencia, false);

  media.addEventListener?.("change", () => {
    let atual = "sistema";
    try { atual = normalizar(localStorage.getItem(CHAVE) || "sistema"); } catch (_) {}
    if (atual === "sistema") aplicarPreferencia("sistema", false);
  });

  window.ControleTema = {
    CHAVE,
    aplicarPreferencia,
    obterPreferencia() {
      try { return normalizar(localStorage.getItem(CHAVE) || preferencia); }
      catch (_) { return preferencia; }
    }
  };
})();
