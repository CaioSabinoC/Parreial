const crypto = require('crypto');

const PASSO_SEGUNDOS = 30;
const DIGITOS = 6;
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // base32 (RFC 4648)

function base32Codificar(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let saida = '';
  for (let i = 0; i < bits.length; i += 5) saida += ALFABETO[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return saida;
}

function base32Decodificar(texto) {
  let bits = '';
  for (const c of texto.replace(/=+$/, '').toUpperCase()) bits += ALFABETO.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function gerarSegredo() {
  return base32Codificar(crypto.randomBytes(20)); // 160 bits
}

// Número do passo de 30 s em que o instante (em ms) cai
function passoDe(agoraMs = Date.now()) {
  return Math.floor(agoraMs / 1000 / PASSO_SEGUNDOS);
}

// HOTP (RFC 4226) aplicado ao número do passo = TOTP (RFC 6238)
function codigoDoPasso(segredo, passo) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const hmac = crypto.createHmac('sha1', base32Decodificar(segredo)).update(contador).digest();
  const deslocamento = hmac[hmac.length - 1] & 0x0f;
  const numero = hmac.readUInt32BE(deslocamento) & 0x7fffffff;
  return String(numero % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

// Devolve o passo em que o código bateu (ou null). A janela aceita pequenas diferenças de relógio.
function verificar(segredo, codigo, { janela = 1, agoraMs = Date.now() } = {}) {
  if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo.trim())) return null;
  const alvo = Buffer.from(codigo.trim());
  const atual = passoDe(agoraMs);
  for (let delta = -janela; delta <= janela; delta++) {
    const esperado = Buffer.from(codigoDoPasso(segredo, atual + delta));
    if (crypto.timingSafeEqual(esperado, alvo)) return atual + delta;
  }
  return null;
}

function urlOtpauth(segredo, conta, emissor) {
  const rotulo = encodeURIComponent(`${emissor}:${conta}`);
  return `otpauth://totp/${rotulo}?secret=${segredo}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=${DIGITOS}&period=${PASSO_SEGUNDOS}`;
}

module.exports = { gerarSegredo, codigoDoPasso, passoDe, verificar, urlOtpauth, base32Decodificar };
