/* ==========================================================================
   COMPONENTS/CARTOES.JS
   Tudo que é específico de cartão de crédito fica aqui:

   1) A REGRA DA FATURA — descobrir em qual fatura uma compra vai cair.
   2) A GERAÇÃO AUTOMÁTICA DE PARCELAS — transformar uma compra de
      R$ 1.200 em 12x, cada uma no mês certo.
   3) O DESENHO DO CARTÃO na tela (aquele retângulo colorido).

   DOIS TIPOS DE CARTÃO
   --------------------
   - "proprio"  → seu cartão. Você pode informar melhor dia de compra,
                  vencimento, limite, banco e bandeira (tudo opcional,
                  menos o nome).
   - "terceiro" → cartão de outra pessoa (mãe, irmã, um amigo que
                  empresta de vez em quando). Aqui você só precisa do
                  nome do cartão e, se quiser, de quem ele é. Nada de
                  limite, banco ou bandeira — não faz sentido controlar
                  o limite de um cartão que não é seu.

   Quando o cartão NÃO tem "melhor dia de compra" informado, o sistema
   usa a regra simples: a compra entra na fatura do próprio mês em que
   foi feita, e as parcelas seguintes vão caindo nos meses seguintes.
   É exatamente como uma planilha organizada por mês funciona.

   FORMATO DOS DADOS:

   usuarios/{uid}/cartoes/{id} = {
     nome: "Cartão da mãe",
     tipo: "proprio" | "terceiro",
     titular: "Mãe",              // só para tipo "terceiro"
     banco: "", bandeira: "",     // opcionais, só para "proprio"
     limite: 0,                   // opcional, 0 = não controlar limite
     cor: "#8B5CF6",
     melhorDiaCompra: 21,         // opcional (1 a 31)
     diaVencimento: 27,           // opcional (1 a 31)
     createdAt, updatedAt
   }

   usuarios/{uid}/compras/{id} = {
     cartaoId, descricao, valorTotal, quantidadeParcelas,
     parcelaInicial, categoria, data, observacoes, createdAt, updatedAt
   }

   usuarios/{uid}/parcelas/{id} = {
     compraId, cartaoId, descricao, categoria,
     numero, totalParcelas, valor,
     mesFatura: "2026-11", dataVencimento: "2026-11-27" (ou ""),
     pago: false, createdAt, updatedAt
   }
   ========================================================================== */

import {
  formatarMoeda,
  calcularParcelas,
  somarMeses,
  dataIsoSegura,
  iconeSvg
} from "../js/utils.js";

/* --------------------------------------------------------------------
   LISTAS PRONTAS PARA OS FORMULÁRIOS
   -------------------------------------------------------------------- */
export const BANDEIRAS = [
  "", "Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outra"
];

// Cores sugeridas para o cartão (o usuário escolhe clicando)
export const CORES_CARTAO = [
  "#0D5C4C", "#8B5CF6", "#E5484D", "#F5A623",
  "#3B82F6", "#EC4899", "#14B8A6", "#12181F"
];

/* --------------------------------------------------------------------
   1. A REGRA DA FATURA

   Com "melhor dia de compra" informado:
   - O cartão fecha a fatura um dia antes do melhor dia de compra.
     Melhor dia 21 → fechamento dia 20.
   - Comprou até o dia 20 → cai na fatura que já vai fechar.
   - Comprou do dia 21 em diante → cai na fatura do mês seguinte.
   - Se o vencimento é depois do fechamento (fecha 20, vence 27), a
     fatura vence no mesmo mês. Se for antes, vence no mês seguinte.

   Sem "melhor dia de compra" (o caso dos cartões de terceiros):
   - A compra simplesmente entra na fatura do mês em que foi feita.

   Devolve sempre o MÊS DA FATURA no formato "aaaa-mm".
   -------------------------------------------------------------------- */
export function mesFaturaDaCompra(dataCompraIso, melhorDiaCompra, diaVencimento) {
  const [ano, mes, dia] = dataCompraIso.split("-").map(Number);
  const mesDaCompra = `${ano}-${String(mes).padStart(2, "0")}`;

  // Regra simples: sem melhor dia de compra, vale o mês da própria compra
  if (!Number(melhorDiaCompra)) return mesDaCompra;

  const diaFechamento = Math.max(1, Number(melhorDiaCompra) - 1);
  let mesFechamento = mesDaCompra;

  // Comprou depois do fechamento? Então entra no ciclo do mês seguinte.
  if (dia > diaFechamento) {
    mesFechamento = somarMeses(mesFechamento, 1);
  }

  // Sem dia de vencimento informado, a fatura fica no mês do fechamento
  if (!Number(diaVencimento)) return mesFechamento;

  return Number(diaVencimento) > diaFechamento
    ? mesFechamento
    : somarMeses(mesFechamento, 1);
}

/* --------------------------------------------------------------------
   2. GERAÇÃO AUTOMÁTICA DAS PARCELAS

   Recebe uma compra e o cartão dela, e devolve a lista completa de
   parcelas já com o mês (e a data, quando houver vencimento) de cada uma.

   O parâmetro "parcelasAntigas" existe só para o caso de EDIÇÃO: se a
   compra já existia e algumas parcelas estavam marcadas como pagas,
   a marcação é preservada ao regerar.
   -------------------------------------------------------------------- */
/* --------------------------------------------------------------------
   2-B. ASSINATURAS (compras recorrentes, ex: Netflix, academia)

   Diferença para uma compra parcelada:
   - Não tem número de parcelas fixo: cobra todo mês, para sempre,
     até o usuário CANCELAR.
   - Por isso, em vez de gerar tudo de uma vez, o sistema mantém
     sempre um "colchão" de alguns meses gerados à frente (constante
     abaixo) e completa esse colchão sozinho toda vez que o app é
     aberto — assim a assinatura nunca "acaba" sem querer.
   - Cancelar guarda o mês em que a cobrança parou (compra.dataFim) e
     as cobranças futuras que ainda não foram pagas são apagadas; o
     histórico de cobranças passadas continua intacto.
   -------------------------------------------------------------------- */
export const MESES_ANTECIPACAO_ASSINATURA = 12;

export function gerarParcelasRecorrentes(compra, cartao, mesLimite, parcelasAntigas = []) {
  const mesInicio = mesFaturaDaCompra(compra.data, cartao.melhorDiaCompra, cartao.diaVencimento);

  // Se a assinatura foi cancelada antes do limite pedido, para nela
  const mesFinal = (compra.dataFim && compra.dataFim < mesLimite) ? compra.dataFim : mesLimite;
  if (mesFinal < mesInicio) return [];

  const pagasPorMes = new Set(parcelasAntigas.filter((p) => p.pago).map((p) => p.mesFatura));
  const cobrancasExcluidas = compra.cobrancasExcluidas || {};
  const diaVencimento = Number(cartao.diaVencimento) || 0;
  const agora = Date.now();
  const parcelas = [];

  let mes = mesInicio;
  while (mes <= mesFinal) {
    // Uma cobrança removida manualmente de um mês específico não deve
    // reaparecer quando o sistema completar os 12 meses futuros.
    if (cobrancasExcluidas[mes]) {
      mes = somarMeses(mes, 1);
      continue;
    }

    parcelas.push({
      compraId: compra.id,
      cartaoId: compra.cartaoId,
      descricao: compra.descricao,
      categoria: compra.categoria || "",
      recorrente: true,
      valor: Number(compra.valorTotal) || 0,
      mesFatura: mes,
      dataVencimento: diaVencimento ? dataIsoSegura(mes, diaVencimento) : "",
      pago: pagasPorMes.has(mes),
      createdAt: agora,
      updatedAt: agora
    });
    mes = somarMeses(mes, 1);
  }

  return parcelas;
}

// Remove duplicidades visuais de cobranças recorrentes.
// A chave correta de uma assinatura é: uma cobrança por compra + mês.
// Se por qualquer motivo o banco contiver duas cópias do mesmo mês,
// a interface considera apenas uma e preserva o status "pago" caso
// alguma das cópias já tenha sido quitada.
export function consolidarParcelasRecorrentes(lista = []) {
  const resultado = [];
  const indicePorChave = new Map();

  for (const parcela of Array.isArray(lista) ? lista : []) {
    if (!parcela?.recorrente || !parcela.compraId || !parcela.mesFatura) {
      resultado.push(parcela);
      continue;
    }

    const chave = `${parcela.compraId}::${parcela.mesFatura}`;
    if (!indicePorChave.has(chave)) {
      indicePorChave.set(chave, resultado.length);
      resultado.push({ ...parcela });
      continue;
    }

    const indice = indicePorChave.get(chave);
    const atual = resultado[indice];

    // Se uma das cópias está paga, a cobrança consolidada também fica paga.
    if (parcela.pago && !atual.pago) {
      resultado[indice] = { ...parcela, pago: true };
    } else if (parcela.pago) {
      resultado[indice] = { ...atual, pago: true };
    }
  }

  return resultado;
}

export function gerarParcelasDaCompra(compra, cartao, parcelasAntigas = []) {
  const quantidade = Math.max(1, Number(compra.quantidadeParcelas) || 1);
  const parcelaInicial = Math.min(Math.max(1, Number(compra.parcelaInicial) || 1), quantidade);

  // Divide o valor total em parcelas iguais (os centavos que sobram
  // vão para a última parcela, para a soma bater exatamente)
  const valores = calcularParcelas(Number(compra.valorTotal) || 0, quantidade);

  const mesPrimeiraFatura = mesFaturaDaCompra(
    compra.data,
    cartao.melhorDiaCompra,
    cartao.diaVencimento
  );

  // Guarda quais números de parcela já estavam pagos, para não perder
  const pagasAntes = new Set(
    parcelasAntigas.filter((p) => p.pago).map((p) => Number(p.numero))
  );

  const parcelasExcluidas = compra.parcelasExcluidas || {};
  const diaVencimento = Number(cartao.diaVencimento) || 0;
  const agora = Date.now();
  const parcelas = [];

  for (let numero = parcelaInicial; numero <= quantidade; numero += 1) {
    // Se o usuário removeu manualmente uma parcela específica da fatura,
    // respeitamos essa escolha mesmo depois de editar a compra.
    if (parcelasExcluidas[String(numero)]) continue;

    const mesFatura = somarMeses(mesPrimeiraFatura, numero - parcelaInicial);

    parcelas.push({
      compraId: compra.id,
      cartaoId: compra.cartaoId,
      descricao: compra.descricao,
      categoria: compra.categoria || "",
      numero,
      totalParcelas: quantidade,
      valor: valores[numero - 1],
      mesFatura,
      // Sem dia de vencimento informado, guardamos vazio: a fatura fica
      // identificada apenas pelo mês.
      dataVencimento: diaVencimento ? dataIsoSegura(mesFatura, diaVencimento) : "",
      pago: pagasAntes.has(numero),
      createdAt: agora,
      updatedAt: agora
    });
  }

  return parcelas;
}

/* --------------------------------------------------------------------
   3. RESUMO DE UM CARTÃO
   Calcula quanto ainda está em aberto (parcelas não pagas) e, quando
   há limite informado, quanto sobra de limite disponível.
   -------------------------------------------------------------------- */
export function resumirCartao(cartao, parcelasDoCartao) {
  const emAberto = parcelasDoCartao
    .filter((p) => !p.pago)
    .reduce((total, p) => total + (Number(p.valor) || 0), 0);

  const limite = Number(cartao.limite) || 0;
  const temLimite = limite > 0;

  return {
    emAberto,
    limite,
    temLimite,
    disponivel: temLimite ? Math.max(0, limite - emAberto) : 0,
    percentualUsado: temLimite ? Math.min(100, (emAberto / limite) * 100) : 0
  };
}

// Um cartão é de terceiro? (função curtinha, mas usada em vários lugares)
export function ehCartaoDeTerceiro(cartao) {
  return cartao.tipo === "terceiro";
}

/* --------------------------------------------------------------------
   4. O DESENHO DO CARTÃO NA TELA
   Só mostra o que existe: se o cartão não tem limite, banco ou datas,
   essas linhas simplesmente não aparecem.
   -------------------------------------------------------------------- */
export function renderizarCartaoVisual(cartao, resumo, opcoes = {}) {
  const cor = cartao.cor || CORES_CARTAO[0];
  const terceiro = ehCartaoDeTerceiro(cartao);

  // Linha de cima: banco (cartão próprio) ou "de Fulano" (cartão de terceiro)
  const identificacao = terceiro
    ? `de ${cartao.titular || "outra pessoa"}`
    : (cartao.banco || "Cartão");

  // Datas: mostra só as que foram preenchidas
  const datas = [
    cartao.melhorDiaCompra ? `Melhor dia: <strong>${cartao.melhorDiaCompra}</strong>` : "",
    cartao.diaVencimento ? `Vence dia: <strong>${cartao.diaVencimento}</strong>` : ""
  ].filter(Boolean).join("");

  // Barra de limite: só faz sentido em cartão com limite informado
  const blocoLimite = resumo.temLimite ? `
    <div class="cartao-barra" title="${Math.round(resumo.percentualUsado)}% do limite usado">
      <div class="cartao-barra__preenchimento"
           style="width: ${resumo.percentualUsado}%; background: ${cor}"></div>
    </div>
    <div class="cartao-limites">
      <span>Disponível <strong class="numero">${formatarMoeda(resumo.disponivel)}</strong></span>
      <span>Limite <strong class="numero">${formatarMoeda(resumo.limite)}</strong></span>
    </div>
  ` : "";

  const rotuloValor = opcoes.rotuloValor || (terceiro ? "Você ainda deve" : "Fatura em aberto");
  const valorExibido = Number(opcoes.valorExibido ?? resumo.emAberto) || 0;

  return `
    <article class="cartao-item">
      <div class="cartao-visual" style="--cor-cartao: ${cor}">
        <div class="cartao-visual__topo">
          <span class="cartao-visual__banco">${identificacao}</span>
          <span class="cartao-visual__bandeira">
            ${terceiro ? `${iconeSvg("usuario", 13)} De terceiro` : (cartao.bandeira || "")}
          </span>
        </div>

        <span class="cartao-visual__nome">${cartao.nome || "Sem nome"}</span>

        <div class="cartao-visual__rodape">
          <div>
            <span class="cartao-visual__rotulo">
              ${rotuloValor}
            </span>
            <span class="cartao-visual__valor numero">${formatarMoeda(valorExibido)}</span>
          </div>
          ${datas ? `<div class="cartao-visual__datas">${datas}</div>` : ""}
        </div>
      </div>

      <div class="cartao-detalhes">
        ${blocoLimite}
        <div class="cartao-acoes">
          <button class="botao-icone" title="Editar cartão"
                  data-acao="editar-cartao" data-id="${cartao.id}">${iconeSvg("editar")}</button>
          <button class="botao-icone botao-icone--perigo" title="Excluir cartão"
                  data-acao="excluir-cartao" data-id="${cartao.id}">${iconeSvg("excluir")}</button>
        </div>
      </div>
    </article>
  `;
}
