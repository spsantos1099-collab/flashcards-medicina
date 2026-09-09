/* ==========================================================================
   CONFIG.JS
   Configurações gerais do sistema que NÃO são segredo (podem ficar
   públicas no código). As chaves do Firebase entram aqui também — chaves
   de projeto Firebase para apps web são públicas por natureza, a
   segurança real vem das REGRAS do Firestore, que vamos configurar na
   Etapa 2 (Firebase).
   ========================================================================== */

// Cole aqui o bloco "firebaseConfig" que o Firebase mostrou pra você na
// Etapa 2, ao registrar o app Web. O campo "databaseURL" é o endereço do
// seu Realtime Database — sem ele a conexão com o banco não funciona.
export const firebaseConfig = {
  apiKey: "AIzaSyDu8YyHBXthD3ibvK9HsOEoU_yGH450IDs",
  authDomain: "controle-financeiro-a0e5b.firebaseapp.com",
  databaseURL: "https://controle-financeiro-a0e5b-default-rtdb.firebaseio.com",
  projectId: "controle-financeiro-a0e5b",
  storageBucket: "controle-financeiro-a0e5b.firebasestorage.app",
  messagingSenderId: "760797448330",
  appId: "1:760797448330:web:90c464981f409977b78573"
};

// Categorias padrão de despesas (o usuário poderá criar outras dentro do app)
export const CATEGORIAS_DESPESA_PADRAO = [
  "Moradia", "Mercado", "Transporte", "Saúde", "Academia", "Lazer",
  "Assinaturas", "Remédios", "Telefone", "Internet", "Impostos", "Outros"
];

// Categorias padrão de receita
export const CATEGORIAS_RECEITA_PADRAO = [
  "Salário", "Freelance", "Investimentos", "Reembolso", "Outros"
];

// Configuração geral do app
export const APP_CONFIG = {
  nome: "Controle Financeiro",
  moedaPadrao: "BRL",
  localePadrao: "pt-BR",
  temaPadrao: "claro" // 'claro' | 'escuro'
};
