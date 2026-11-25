const mongoose = require('mongoose');

const dispositivoSchema = new mongoose.Schema({
  donoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  nome: { type: String, required: true, trim: true },
  // Canal do ThingSpeak. Único: um canal pertence a um só usuário
  canalId: { type: String, required: true, unique: true, trim: true },
  intervaloSegundos: { type: Number, min: 15, default: 60 }, // configuração do dispositivo
  comandos: [{
    comando: { type: String, required: true },
    registradoEm: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Dispositivo', dispositivoSchema);
