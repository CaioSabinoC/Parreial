const config = require('../config/env');

// Todo evento de segurança sai com o código de missão. Nunca registre senha, segredo ou código OTP.
function registrar(evento, detalhes = {}) {
  const codigo = config.seguranca.codigoMissao || '------';
  console.log(`[seguranca][${codigo}] ${new Date().toISOString()} ${evento} ${JSON.stringify(detalhes)}`);
}

module.exports = { registrar };
