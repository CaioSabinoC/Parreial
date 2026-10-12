const mqtt = require('mqtt');
const config = require('../config/env');
const { tratarMensagem } = require('./handler');

let client = null;

function iniciar() {
  const cfg = config.mqtt;

  if (!cfg.enabled) {
    console.log('[mqtt] desativado (MQTT_ENABLED=false)');
    return null;
  }

  const faltando = ['clientId', 'username', 'password', 'channelId'].filter((k) => !cfg[k]);
  if (faltando.length) {
    console.warn(`[mqtt] não iniciado, faltam variáveis de ambiente: ${faltando.join(', ')}`);
    return null;
  }

  client = mqtt.connect({
    protocol: cfg.protocol,
    host: cfg.host,
    port: cfg.port,
    clientId: cfg.clientId,
    username: cfg.username,
    password: cfg.password,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
  });

  // Assina a cada (re)conexão, pois a sessão é limpa ao reconectar
  client.on('connect', () => {
    console.log(`[mqtt] conectado a ${cfg.host}`);
    client.subscribe(cfg.topic, { qos: 0 }, (err) => {
      if (err) console.error('[mqtt] erro ao assinar:', err.message);
      else console.log(`[mqtt] assinando ${cfg.topic}`);
    });
  });

  client.on('message', (topic, payload) => {
    tratarMensagem(topic, payload).catch((err) => console.error('[mqtt] erro ao salvar:', err.message));
  });

  client.on('reconnect', () => console.log('[mqtt] reconectando...'));
  client.on('close', () => console.log('[mqtt] conexão fechada'));
  client.on('error', (err) => console.error('[mqtt] erro:', err.message));

  return client;
}

function estaConectado() {
  return Boolean(client && client.connected);
}

function encerrar() {
  return new Promise((resolve) => {
    if (!client) return resolve();
    client.end(false, {}, resolve);
  });
}

module.exports = { iniciar, estaConectado, encerrar };
