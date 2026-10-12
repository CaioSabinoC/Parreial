const Safra = require('../models/Safra');
const Leitura = require('../models/Leitura');
const Previsao = require('../models/Previsao');
const P = require('../config/parametrosVideira');

const MS_DIA = 24 * 60 * 60 * 1000;

function erro(status, mensagem) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

// Nota de 0 a 1: 1 dentro da faixa ideal, cai linearmente fora dela
function scoreFaixa(valor, { min, max, tolerancia }) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return null;
  if (valor >= min && valor <= max) return 1;
  const distancia = valor < min ? min - valor : valor - max;
  return Math.max(0, 1 - distancia / tolerancia);
}

// Agrega as leituras por dia (fuso de Recife)
function agregarPorDia(inicio, fim, canalId) {
  const filtro = { lidoEm: { $gte: inicio, $lte: fim } };
  if (canalId) filtro.canalId = canalId;

  return Leitura.aggregate([
    { $match: filtro },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$lidoEm', timezone: 'America/Recife' } },
        tempMedia: { $avg: '$temperatura' },
        tempMax: { $max: '$temperatura' },
        arMedia: { $avg: '$umidadeAr' },
        soloMedia: { $avg: '$umidadeSolo' },
        n: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

function notaDoDia(dia) {
  const notas = [
    scoreFaixa(dia.tempMedia, P.faixas.temperatura),
    scoreFaixa(dia.arMedia, P.faixas.umidadeAr),
    scoreFaixa(dia.soloMedia, P.faixas.umidadeSolo),
  ].filter((n) => n !== null);

  if (!notas.length) return null;

  let nota = notas.reduce((a, b) => a + b, 0) / notas.length;
  if (dia.tempMax > P.estresseCalor.tempMaxC) nota *= P.estresseCalor.fator;
  return nota;
}

function grausDiaDoDia(dia) {
  if (dia.tempMedia === null || dia.tempMedia === undefined) return 0;
  return Math.max(0, dia.tempMedia - P.baseTempC);
}

const media = (lista) => (lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : 0);

async function calcularPrevisao(safraId, { persistir = false } = {}) {
  const safra = await Safra.findById(safraId);
  if (!safra) throw erro(404, 'Safra não encontrada');

  if (safra.status === 'encerrada') {
    return { safraId: safra._id, status: 'encerrada', kgReal: safra.colheitaRealKg ?? null };
  }

  const agora = new Date();
  const dias = await agregarPorDia(safra.dataPoda, agora, safra.canalId);
  if (!dias.length) throw erro(422, 'Ainda não há leituras no período desta safra');

  const diasDecorridos = Math.max(1, Math.ceil((agora - safra.dataPoda) / MS_DIA));
  const cobertura = Math.min(1, dias.length / diasDecorridos);

  // --- Fator climático (0 a 1) ---
  const notas = dias.map(notaDoDia).filter((n) => n !== null);
  const fatorClima = media(notas);
  const kgEstimado = Math.round(safra.areaHa * safra.produtividadeBaseKgHa * fatorClima);

  // --- Graus-dia e data da colheita ---
  const gddDiarios = dias.map(grausDiaDoDia);
  // Dias sem leitura (dispositivo offline) são compensados pela média dos dias com dado
  const grausDiaAcumulados = media(gddDiarios) * diasDecorridos;
  // Prioridade: valor informado na safra > tabela por variedade > padrão
  const grausDiaAlvo =
    safra.grausDiaColheita ?? P.grausDiaPorVariedade[safra.variedade] ?? P.grausDiaColheitaPadrao;

  const ritmo = media(gddDiarios.slice(-P.janelaRitmoDias)); // °C-dia por dia
  let diasRestantes = null;
  if (grausDiaAcumulados >= grausDiaAlvo) diasRestantes = 0;
  else if (ritmo > 0) diasRestantes = Math.ceil((grausDiaAlvo - grausDiaAcumulados) / ritmo);

  const dataColheitaPrevista =
    diasRestantes === null ? null : new Date(agora.getTime() + diasRestantes * MS_DIA);

  const resultado = {
    safraId: safra._id,
    nome: safra.nome,
    status: 'ativa',
    kgEstimado,
    fatorClima: Number(fatorClima.toFixed(3)),
    grausDiaAcumulados: Math.round(grausDiaAcumulados),
    grausDiaAlvo,
    diasRestantes,
    dataColheitaPrevista,
    diasComLeitura: dias.length,
    diasDecorridos,
    confiabilidade: cobertura >= P.coberturaMinima ? 'normal' : 'baixa',
  };

  if (persistir) {
    await Previsao.create({
      safraId: safra._id,
      kgEstimado: resultado.kgEstimado,
      fatorClima: resultado.fatorClima,
      grausDiaAcumulados: resultado.grausDiaAcumulados,
      diasRestantes: resultado.diasRestantes,
      dataColheitaPrevista: resultado.dataColheitaPrevista,
      confiabilidade: resultado.confiabilidade,
    });
  }

  return resultado;
}

// Soma dos kg previstos das safras ativas cuja colheita cai no período
async function previsaoPorPeriodo(inicio, fim) {
  const safras = await Safra.find({ status: 'ativa' });
  const resultados = await Promise.all(
    safras.map((s) => calcularPrevisao(s._id).catch(() => null)) // ignora safras sem leitura
  );

  const noPeriodo = resultados.filter(
    (r) => r && r.dataColheitaPrevista && r.dataColheitaPrevista >= inicio && r.dataColheitaPrevista <= fim
  );

  return {
    inicio,
    fim,
    totalKg: noPeriodo.reduce((soma, r) => soma + r.kgEstimado, 0),
    safras: noPeriodo,
  };
}

module.exports = { calcularPrevisao, previsaoPorPeriodo };
