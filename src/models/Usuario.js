const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  senhaHash: { type: String, required: true },

  // OTP (TOTP): o segredo fica cifrado; só vale depois de confirmado com um código
  otpSegredoCifrado: { type: String, required: true },
  otpAtivo: { type: Boolean, default: false },
  otpUltimoPasso: { type: Number, default: 0 }, // impede reutilizar o mesmo código

  codigosRecuperacao: [String], // hashes; cada código vale uma vez

  falhasSeguidas: { type: Number, default: 0 },
  bloqueadoAte: Date,
}, { timestamps: true });

module.exports = mongoose.model('Usuario', usuarioSchema);
