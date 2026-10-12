const Leitura = require('../models/Leitura');

const MS_DIA = 24 * 60 * 60 * 1000;

async function listar({ inicio, fim, canalId, limite = 500 }) {
  const filtro = { lidoEm: { $gte: inicio, $lte: fim } };
  if (canalId) filtro.canalId = canalId;

  const leituras = await Leitura.find(filtro).sort({ lidoEm: -1 }).limit(limite).lean();
  return leituras.reverse(); // devolve em ordem cronológica
}

function ultima(canalId) {
  const filtro = canalId ? { canalId } : {};
  return Leitura.findOne(filtro).sort({ lidoEm: -1 }).lean();
}

async function resumo(periodo, canalId) {
  const dias = periodo === 'semana' ? 7 : 1;
  const inicio = new Date(Date.now() - dias * MS_DIA);

  const filtro = { lidoEm: { $gte: inicio } };
  if (canalId) filtro.canalId = canalId;

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
