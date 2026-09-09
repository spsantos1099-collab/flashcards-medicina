/* ==========================================================================
   APP.JS
   Comportamentos globais: proteção das páginas, sincronização da preferência
   de tema e toasts. O tema inicial é aplicado por theme-init.js antes do CSS.
   ========================================================================== */

import { observarUsuario, sair, buscarUmaVez } from "./firebase.js";

function nomeCompletoPerfil(perfil, usuario) {
  const nomeExibicao = String(perfil?.nomeExibicao || "").trim();
  if (nomeExibicao) return nomeExibicao;
  const nomeCompleto = [perfil?.nome, perfil?.sobrenome].filter(Boolean).join(" ").trim();
  return nomeCompleto || usuario?.displayName || usuario?.email || "Minha conta";
}

function iniciaisPerfil(perfil, usuario) {
  const nome = nomeCompletoPerfil(perfil, usuario);
  const partes = nome.split(/\s+/).filter(Boolean);
  return (partes.length > 1 ? `${partes[0][0]}${partes[partes.length - 1][0]}` : nome.slice(0, 2)).toUpperCase();
}

async function carregarIdentidadeDoPerfil(usuario) {
  if (!usuario) return;
  let perfil = {};
  try {
    perfil = await buscarUmaVez(usuario.uid, "perfil/principal");
  } catch (_) {}

  const resumo = nomeCompletoPerfil(perfil, usuario);
  document.querySelectorAll("[data-usuario-resumo]").forEach((elemento) => {
    elemento.textContent = resumo;
  });
  document.querySelectorAll("[data-usuario-iniciais]").forEach((elemento) => {
    elemento.textContent = iniciaisPerfil(perfil, usuario);
  });
}

async function sincronizarTemaDoPerfil(usuario) {
  if (!usuario || !window.ControleTema) return;

  try {
    const preferencias = await buscarUmaVez(usuario.uid, "configuracoes/preferencias");
    const tema = preferencias?.tema;
    if (["sistema", "claro", "escuro"].includes(tema)) {
      window.ControleTema.aplicarPreferencia(tema, true);
    }
  } catch (_) {
    // A preferência local continua funcionando mesmo se a rede estiver fora.
  }
}

function protegerPaginaSeNecessario() {
  const paginaProtegida = document.body.dataset.protegida === "true";
  if (!paginaProtegida) return;

  const raiz = document.body.dataset.raiz || "";

  observarUsuario((usuario) => {
    if (!usuario) {
      window.location.href = `${raiz}index.html`;
      return;
    }

    document.querySelectorAll("[data-usuario-email]").forEach((elemento) => {
      elemento.textContent = usuario.email || "";
    });
    document.querySelectorAll("[data-usuario-resumo]").forEach((elemento) => {
      elemento.textContent = usuario.displayName || usuario.email || "Minha conta";
    });

    sincronizarTemaDoPerfil(usuario);
    carregarIdentidadeDoPerfil(usuario);
  });

  const botaoSair = document.querySelector("[data-sair]");
  if (botaoSair) {
    botaoSair.addEventListener("click", async () => {
      await sair();
      window.location.href = `${raiz}index.html`;
    });
  }
}

function iniciarAplicacao() {
  protegerPaginaSeNecessario();
  document.documentElement.classList.add("app-iniciada");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarAplicacao, { once: true });
} else {
  iniciarAplicacao();
}

/* --------------------------------------------------------------------
   TOASTS
   -------------------------------------------------------------------- */
export function mostrarToast(mensagem, tipo = "sucesso") {
  let container = document.getElementById("containerToasts");
  if (!container) {
    container = document.createElement("div");
    container.id = "containerToasts";
    container.className = "container-toasts";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast--visivel"));

  setTimeout(() => {
    toast.classList.remove("toast--visivel");
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}
