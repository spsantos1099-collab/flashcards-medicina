/* ==========================================================================
   FIREBASE.JS
   Inicializa o Firebase (Authentication + Realtime Database) e exporta
   funções prontas para o resto do sistema usar. As telas (login,
   dashboard, receitas...) vão importar essas funções em vez de mexer
   direto no Firebase — assim, se um dia mudarmos de banco de dados,
   só este arquivo precisa mudar.
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as signOutFirebase,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  update,
  remove,
  push,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

/* --------------------------------------------------------------------
   AUTENTICAÇÃO
   -------------------------------------------------------------------- */

// Login com Google (abre um popup de escolha de conta)
export function entrarComGoogle() {
  const provedor = new GoogleAuthProvider();
  return signInWithPopup(auth, provedor);
}

// Login com e-mail e senha (usuário já cadastrado)
export function entrarComEmailSenha(email, senha) {
  return signInWithEmailAndPassword(auth, email, senha);
}

// Cadastro de uma nova conta com e-mail e senha
export function cadastrarComEmailSenha(email, senha) {
  return createUserWithEmailAndPassword(auth, email, senha);
}

// Sair da conta
export function sair() {
  return signOutFirebase(auth);
}

// Executa uma função sempre que o estado de login mudar
// (usuário logou, deslogou, ou a página recarregou com sessão ativa)
export function observarUsuario(callback) {
  return onAuthStateChanged(auth, callback);
}

/* --------------------------------------------------------------------
   BANCO DE DADOS (Realtime Database)
   Todos os dados de um usuário ficam dentro de "usuarios/SEU_ID/...",
   conforme as regras de segurança que configuramos no console.
   -------------------------------------------------------------------- */

// Caminho base de um usuário, ex: caminhoUsuario(uid, "despesas")
function caminhoUsuario(uid, subcaminho) {
  return `usuarios/${uid}/${subcaminho}`;
}

// Cria um novo registro dentro de uma lista (ex: uma nova despesa) e
// devolve o id gerado automaticamente pelo Firebase
export async function adicionarRegistro(uid, subcaminho, dados) {
  const referencia = push(ref(db, caminhoUsuario(uid, subcaminho)));
  await set(referencia, dados);
  return referencia.key;
}

// Salva um registro usando um ID definido pelo próprio sistema.
// Útil quando o registro precisa ser idempotente: repetir a mesma
// gravação atualiza o mesmo item em vez de criar uma cópia duplicada.
export function salvarRegistroComId(uid, subcaminho, id, dados) {
  return set(ref(db, `${caminhoUsuario(uid, subcaminho)}/${id}`), dados);
}

// Atualiza campos específicos de um registro existente
export function atualizarRegistro(uid, subcaminho, id, dados) {
  return update(ref(db, `${caminhoUsuario(uid, subcaminho)}/${id}`), dados);
}

// Remove um registro
export function removerRegistro(uid, subcaminho, id) {
  return remove(ref(db, `${caminhoUsuario(uid, subcaminho)}/${id}`));
}

// Escuta mudanças em tempo real numa lista (ex: todas as despesas do usuário)
export function observarLista(uid, subcaminho, callback) {
  return onValue(ref(db, caminhoUsuario(uid, subcaminho)), (snapshot) => {
    callback(snapshot.val() || {});
  });
}

// Busca um valor uma única vez (sem ficar escutando mudanças)
export async function buscarUmaVez(uid, subcaminho) {
  const snapshot = await get(ref(db, caminhoUsuario(uid, subcaminho)));
  return snapshot.val() || {};
}
