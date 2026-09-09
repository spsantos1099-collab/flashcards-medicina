/* ========================================================================== 
   COMPONENTS/CALENDARIO.JS
   Funções visuais e de data usadas pela página de Calendário Financeiro.
   Não acessa o Firebase: recebe dados prontos e ajuda a desenhar o mês.
   ========================================================================== */

const NOMES_DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const NOMES_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

// Retorna a quantidade de espaços antes do dia 1 considerando semana
// começando na segunda-feira, além da quantidade de dias do mês.
export function estruturaDoMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const primeiroDia = new Date(ano, numeroMes - 1, 1).getDay();
  const espacosAntes = (primeiroDia + 6) % 7; // domingo (0) vira 6
  const quantidadeDias = new Date(ano, numeroMes, 0).getDate();
  return { ano, numeroMes, espacosAntes, quantidadeDias };
}

export function dataIsoDoDia(mes, dia) {
  return `${mes}-${String(dia).padStart(2, "0")}`;
}

// Ex.: "2026-09-09" -> "quarta-feira, 9 de setembro"
export function dataPorExtenso(dataIso) {
  if (!dataIso) return "Selecione um dia";
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return `${NOMES_DIAS[data.getDay()]}, ${dia} de ${NOMES_MESES[mes - 1]}`;
}

// Valor curto para caber dentro de uma célula pequena do calendário.
// Os valores completos continuam aparecendo no painel do dia.
export function valorCurto(valor) {
  const numero = Number(valor) || 0;
  const absoluto = Math.abs(numero);

  if (absoluto >= 1_000_000) {
    return `${(numero / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (absoluto >= 10_000) {
    return `${(numero / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return numero.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
