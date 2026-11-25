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

module.exports = { listar, ultima, resumo };
