const mongoose = require('mongoose');

// Histórico de previsões, para mostrar a evolução no painel
const previsaoSchema = new mongoose.Schema({
  safraId: { type: mongoose.Schema.Types.ObjectId, ref: 'Safra', required: true, index: true },
  calculadaEm: { type: Date, default: Date.now },
  kgEstimado: Number,
  fatorClima: Number,
  grausDiaAcumulados: Number,
  diasRestantes: Number,
  dataColheitaPrevista: Date,
  confiabilidade: String,
});

module.exports = mongoose.model('Previsao', previsaoSchema);
