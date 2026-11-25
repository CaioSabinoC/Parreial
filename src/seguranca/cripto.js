const crypto = require('crypto');
const config = require('../config/env');

// --- Cifra do segredo do OTP (AES-256-GCM): o banco nunca guarda o segredo em claro ---
function chave() {
  return Buffer.from(config.seguranca.otpChave, 'hex'); // 32 bytes
}

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  return [iv, cifra.getAuthTag(), dados].map((b) => b.toString('base64')).join('.');
}

function decifrar(valor) {
  const [iv, tag, dados] = valor.split('.').map((p) => Buffer.from(p, 'base64'));
  const decifra = crypto.createDecipheriv('aes-256-gcm', chave(), iv);
  decifra.setAuthTag(tag);
  return Buffer.concat([decifra.update(dados), decifra.final()]).toString('utf8');
}

// --- Senha: scrypt com sal aleatório ---
function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(senha, sal, 64);
  return `${sal.toString('hex')}:${hash.toString('hex')}`;
}

function conferirSenha(senha, armazenado) {
  const [sal, hash] = armazenado.split(':');
  const calculado = crypto.scryptSync(senha, Buffer.from(sal, 'hex'), 64);
  return crypto.timingSafeEqual(calculado, Buffer.from(hash, 'hex'));
}

// --- Códigos de recuperação: só o hash fica no banco ---
function hashCodigo(codigo) {
  const limpo = String(codigo).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(limpo).digest('hex');
}

function gerarCodigoRecuperacao() {
  // 10 caracteres sem 0/O/1/I, no formato XXXXX-XXXXX
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (const b of crypto.randomBytes(10)) c += alfabeto[b % alfabeto.length];
  return `${c.slice(0, 5)}-${c.slice(5)}`;
}

module.exports = { cifrar, decifrar, hashSenha, conferirSenha, hashCodigo, gerarCodigoRecuperacao };
