const Leitura = require('../models/Leitura');

const MS_DIA = 24 * 60 * 60 * 1000;

// `canais` = canais do usuário logado (vem de canaisPermitidos). Lista vazia = nenhuma leitura.
async function listar({ inicio, fim, canais, limite = 500 }) {
  const filtro = { lidoEm: { $gte: inicio, $lte: fim }, canalId: { $in: canais } };

  const leituras = await Leitura.find(filtro).sort({ lidoEm: -1 }).limit(limite).lean();
  return leituras.reverse(); // devolve em ordem cronológica
}

function ultima(canais) {
  return Leitura.findOne({ canalId: { $in: canais } }).sort({ lidoEm: -1 }).lean();
}

async function resumo(periodo, canais) {
  const dias = periodo === 'semana' ? 7 : 1;
  const inicio = new Date(Date.now() - dias * MS_DIA);

  const filtro = { lidoEm: { $gte: inicio }, canalId: { $in: canais } };

  const [r] = await Leitura.aggregate([
    { $match: filtro },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        temperatura: { $push: '$temperatura' },
        tempMedia: { $avg: '$temperatura' },
        tempMin: { $min: '$temperatura' },
        tempMax: { $max: '$temperatura' },
        arMedia: { $avg: '$umidadeAr' },
        arMin: { $min: '$umidadeAr' },
        arMax: { $max: '$umidadeAr' },
        soloMedia: { $avg: '$umidadeSolo' },
        soloMin: { $min: '$umidadeSolo' },
        soloMax: { $max: '$umidadeSolo' },
      },
    },
    { $project: { _id: 0, temperatura: 0 } },
  ]);

  return { periodo: periodo === 'semana' ? 'semana' : 'dia', inicio, ...(r || { total: 0 }) };
}

// Última leitura de CADA canal do usuário (para o painel: status online/offline e valores atuais)
async function ultimasPorCanal(canais) {
  // Uma consulta por canal, aproveitando o índice { canalId, lidoEm } (um $sort global estouraria a memória com histórico grande)
  const linhas = await Promise.all(canais.map((canalId) =>
    Leitura.findOne({ canalId }).sort({ lidoEm: -1 }).select('canalId lidoEm temperatura umidadeAr umidadeSolo -_id').lean()
  ));
  return linhas.filter(Boolean);
}

// Recife fica em UTC-3 o ano todo (sem horário de verão). O corte de "dia" usa esse deslocamento.
const OFFSET_RECIFE_MS = 3 * 60 * 60 * 1000;
const MS_HORA = 60 * 60 * 1000;

// Série agregada por hora ou por dia, para gráficos (evita mandar milhares de leituras brutas)
async function serie({ inicio, fim, canais, bucket = 'hora' }) {
  const passo = bucket === 'dia' ? MS_DIA : MS_HORA;
  const deslocamento = bucket === 'dia' ? OFFSET_RECIFE_MS : 0;
  const ms = { $toLong: '$lidoEm' };
  const inicioDoPasso = {
    $subtract: [
      ms,
      { $mod: [{ $subtract: [ms, deslocamento] }, passo] },
    ],
  };

  return Leitura.aggregate([
    { $match: { lidoEm: { $gte: inicio, $lte: fim }, canalId: { $in: canais } } },
    {
      $group: {
        _id: inicioDoPasso,
        temperatura: { $avg: '$temperatura' },
        umidadeAr: { $avg: '$umidadeAr' },
        umidadeSolo: { $avg: '$umidadeSolo' },
        n: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        t: { $toDate: '$_id' },
        temperatura: { $round: ['$temperatura', 1] },
        umidadeAr: { $round: ['$umidadeAr', 1] },
        umidadeSolo: { $round: ['$umidadeSolo', 1] },
        n: 1,
      },
    },
  ]);
}

module.exports = { listar, ultima, ultimasPorCanal, resumo, serie };
