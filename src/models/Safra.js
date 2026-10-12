const mongoose = require('mongoose');

const safraSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  variedade: { type: String, required: true, trim: true },
  // Graus-dia (°C-dia) da poda até a colheita para esta variedade.
  // Se omitido, usa o valor padrão de config/parametrosVideira.js
  grausDiaColheita: { type: Number, min: 1 },
  areaHa: { type: Number, required: true, min: 0.01 },
  dataPoda: { type: Date, required: true },
  produtividadeBaseKgHa: { type: Number, required: true, min: 1 },
  canalId: String, // opcional: restringe as leituras a um canal/dispositivo
  status: { type: String, enum: ['ativa', 'encerrada'], default: 'ativa' },
  colheitaRealKg: Number, // preenchido ao encerrar (dado para o ML da fase 2)
  encerradaEm: Date,
}, { timestamps: true });

safraSchema.index({ status: 1, dataPoda: -1 });

module.exports = mongoose.model('Safra', safraSchema);
