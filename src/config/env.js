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
