/* ==========================================================================
   UTILS.JS
   Funções utilitárias puras, usadas em várias partes do sistema.
   Mantidas separadas do app.js para facilitar reuso e testes.

   FORMATO DOS DADOS (definido aqui para todas as etapas seguirem o mesmo
   padrão — Dashboard, Receitas, Despesas e Relatórios dependem disso):

   usuarios/{uid}/receitas/{id} = {
     descricao: "Salário",
     categoria: "Salário",
     valor: 1500.00,
     data: "2026-08-05",              // formato ISO (aaaa-mm-dd)
     status: "recebido" | "pendente" | "atrasado",
     formaPagamento: "Pix",
     contaBancaria: "Nubank",
     observacoes: "",
     createdAt: 1234567890,
     updatedAt: 1234567890
   }

   usuarios/{uid}/despesas/{id} = {
     descricao: "Conta de luz",
     categoria: "Moradia",
     valor: 150.00,
     data: "2026-08-10",
     status: "pago" | "pendente" | "atrasado",
     formaPagamento: "Boleto",
     contaBancaria: "Nubank",
     observacoes: "",
     createdAt: 1234567890,
     updatedAt: 1234567890
   }
   ========================================================================== */

// Formata um número como moeda brasileira: 1234.5 -> "R$ 1.234,50"
export function formatarMoeda(valor, moeda = "BRL", locale = "pt-BR") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: moeda }).format(valor || 0);
}

// Formata uma data ISO (2026-08-05) para o formato brasileiro (05/08/2026)
export function formatarData(dataIso, locale = "pt-BR") {
  if (!dataIso) return "";
  const data = new Date(dataIso + "T00:00:00");
  return new Intl.DateTimeFormat(locale).format(data);
}

// Gera um identificador simples para uso em elementos temporários da interface
export function gerarId(prefixo = "id") {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Divide um valor em N parcelas iguais, ajustando centavos na última parcela
// para garantir que a soma bata exatamente com o valor total.
export function calcularParcelas(valorTotal, quantidadeParcelas) {
  const valorCentavos = Math.round(valorTotal * 100);
  const parcelaBase = Math.floor(valorCentavos / quantidadeParcelas);
  const resto = valorCentavos - parcelaBase * quantidadeParcelas;

  return Array.from({ length: quantidadeParcelas }, (_, indice) => {
    const centavos = parcelaBase + (indice === quantidadeParcelas - 1 ? resto : 0);
    return centavos / 100;
  });
}

// Converte o objeto vindo do Realtime Database (chave -> valor) em uma
// lista de itens, cada um já carregando seu próprio "id".
export function paraLista(objetoFirebase) {
  if (!objetoFirebase) return [];
  return Object.entries(objetoFirebase).map(([id, dados]) => ({ id, ...dados }));
}

// Retorna o mês/ano atual no formato "aaaa-mm", usado para filtrar
// lançamentos do mês corrente.
export function mesAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

// Verifica se uma data ISO ("aaaa-mm-dd") pertence a um mês ("aaaa-mm")
export function dataPertenceAoMes(dataIso, mes) {
  return typeof dataIso === "string" && dataIso.startsWith(mes);
}

// Soma o campo "valor" de uma lista de lançamentos
export function somarValores(lista) {
  return lista.reduce((total, item) => total + (Number(item.valor) || 0), 0);
}

/* --------------------------------------------------------------------
   FUNÇÕES DE MÊS (usadas pelos cartões, faturas e relatórios)
   Um "mês" aqui é sempre o texto "aaaa-mm", ex: "2026-09".
   -------------------------------------------------------------------- */

const NOMES_MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Soma (ou subtrai, com número negativo) meses: somarMeses("2026-11", 2) -> "2027-01"
export function somarMeses(mes, quantidade) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const data = new Date(ano, numeroMes - 1 + quantidade, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

// Deixa o mês bonito para mostrar na tela: "2026-09" -> "Setembro de 2026"
export function formatarMesAno(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return `${NOMES_MESES[numeroMes - 1]} de ${ano}`;
}

// Quantos dias tem o mês: ultimoDiaDoMes("2026-02") -> 28
export function ultimoDiaDoMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return new Date(ano, numeroMes, 0).getDate();
}

// Monta uma data ISO sem risco de "dia 31 de fevereiro": se o dia não
// existir naquele mês, usa o último dia disponível.
export function dataIsoSegura(mes, dia) {
  const ultimoDia = ultimoDiaDoMes(mes);
  const diaValido = Math.min(Math.max(1, Number(dia) || 1), ultimoDia);
  return `${mes}-${String(diaValido).padStart(2, "0")}`;
}

// Data de hoje em formato ISO ("aaaa-mm-dd"), respeitando o fuso local
export function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

// Ícones vetoriais simples para ações recorrentes. Mantém a interface sóbria
// sem depender de emojis, fontes de ícones ou bibliotecas externas.
export function iconeSvg(nome, tamanho = 16) {
  const base = `viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const caminhos = {
    editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    excluir: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
    duplicar: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    usuario: '<circle cx="12" cy="8" r="3"/><path d="M5 20c.8-4 3-6 7-6s6.2 2 7 6"/>',
    cancelar: '<circle cx="12" cy="12" r="9"/><path d="m8.5 8.5 7 7"/>'
  };
  return caminhos[nome] ? `<svg ${base}>${caminhos[nome]}</svg>` : "";
}
