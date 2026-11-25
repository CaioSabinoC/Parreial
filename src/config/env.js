require('dotenv').config({ quiet: true });

const num = (valor, padrao) => {
  if (valor === undefined || valor === '') return padrao;
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
};

const channelId = process.env.THINGSPEAK_CHANNEL_ID;

module.exports = {
  port: num(process.env.PORT, 3000),
  mongoUri: process.env.MONGODB_URI,
  corsOrigin: process.env.CORS_ORIGIN || '*',

  mqtt: {
    enabled: process.env.MQTT_ENABLED !== 'false',
    protocol: process.env.MQTT_PROTOCOL || 'mqtts',
    host: process.env.MQTT_HOST || 'mqtt3.thingspeak.com',
    port: num(process.env.MQTT_PORT, 8883),
    clientId: process.env.MQTT_CLIENT_ID,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    channelId,
    // Confirme o formato do tópico na documentação do ThingSpeak
    topic: process.env.MQTT_TOPIC || `channels/${channelId}/subscribe`,
  },

  // --- Segurança (OTP + JWT + IDOR) ---
  seguranca: {
    codigoMissao: process.env.CODIGO_MISSAO,       // 6 caracteres, aparece nos logs
    jwtSecret: process.env.JWT_SECRET,             // assina os tokens (mín. 32 caracteres)
    otpChave: process.env.OTP_CHAVE,               // 64 hex: cifra o segredo do OTP no banco
    otpEmissor: process.env.OTP_EMISSOR || 'Parreiral',
    otpJanela: num(process.env.OTP_JANELA, 1),     // passos de 30 s aceitos para cada lado
    tokenAcessoMin: num(process.env.TOKEN_ACESSO_MIN, 60),
    tokenParcialMin: num(process.env.TOKEN_PARCIAL_MIN, 5),
    maxFalhas: num(process.env.MAX_FALHAS, 5),     // erros seguidos antes de bloquear
    bloqueioMin: num(process.env.BLOQUEIO_MIN, 15),
  },

  // Qual field do ThingSpeak guarda cada sensor
  campos: {
    temperatura: num(process.env.FIELD_TEMPERATURA, 1),
    umidadeAr: num(process.env.FIELD_UMIDADE_AR, 2),
    umidadeSolo: num(process.env.FIELD_UMIDADE_SOLO, 3),
  },

  // Calibração do sensor de solo (valores brutos do ADC). Se ambos forem
  // definidos, o back converte o valor bruto em %. Se não, espera já em %.
  soloRaw: {
    seco: num(process.env.SOLO_RAW_SECO, null),
    molhado: num(process.env.SOLO_RAW_MOLHADO, null),
  },
};

// A API não sobe sem a configuração de segurança (chamada em server.js)
module.exports.validarSeguranca = function validarSeguranca() {
  const s = module.exports.seguranca;
  if (!/^[A-Za-z0-9]{6}$/.test(s.codigoMissao || '')) {
    throw new Error('Defina CODIGO_MISSAO no .env (6 letras/números)');
  }
  if (!s.jwtSecret || s.jwtSecret.length < 32) {
    throw new Error('Defina JWT_SECRET no .env (mínimo 32 caracteres)');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(s.otpChave || '')) {
    throw new Error('Defina OTP_CHAVE no .env (64 caracteres hexadecimais)');
  }
};
