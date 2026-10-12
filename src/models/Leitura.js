const mongoose = require('mongoose');

const leituraSchema = new mongoose.Schema({
  temperatura: Number,   // °C (DHT11)
  umidadeAr: Number,     // % (DHT11)
  umidadeSolo: Number,   // % (sensor de solo, já calibrado)
  canalId: String,
  lidoEm: { type: Date, required: true },
});

// Evita duplicar a mesma leitura se o MQTT reenviar após reconexão
leituraSchema.index({ canalId: 1, lidoEm: 1 }, { unique: true });

module.exports = mongoose.model('Leitura', leituraSchema);
