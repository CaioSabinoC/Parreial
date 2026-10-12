const Leitura = require('../models/Leitura');
const config = require('../config/env');

// Limites de sanidade: valores fora disso são descartados (ex.: leitura inválida do DHT11)
const LIMITES = {
  temperatura: [-10, 60],
  umidadeAr: [0, 100],
  umidadeSolo: [0, 100],
};

function paraNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
}

// Converte valor bruto do ADC em % usando os pontos de calibração (seco/molhado)
function converterSolo(bruto, { seco, molhado }) {
  if (seco == null || molhado == null || seco === molhado) return bruto;
  const pct = ((seco - bruto) / (seco - molhado)) * 100;
  return Math.min(100, Math.max(0, pct));
}

// Transforma a mensagem do ThingSpeak em um objeto de leitura (ou null se inválida)
function interpretarMensagem(payload, opcoes = {}) {
  const campos = opcoes.campos ?? config.campos;
  const soloRaw = opcoes.soloRaw ?? config.soloRaw;
  const canalPadrao = opcoes.canalId ?? config.mqtt.channelId ?? '';

  let dados;
  try {
    dados = JSON.parse(payload.toString());
  } catch {
    return null;
  }
  if (!dados || typeof dados !== 'object') return null;

  const leitura = {};
  for (const [nome, numeroField] of Object.entries(campos)) {
    let valor = paraNumero(dados[`field${numeroField}`]);
    if (valor === undefined) continue;
    if (nome === 'umidadeSolo') valor = converterSolo(valor, soloRaw);

    const [min, max] = LIMITES[nome];
    if (valor < min || valor > max) {
      console.warn(`[mqtt] ${nome} fora do intervalo (${valor}); valor descartado`);
      continue;
    }
    leitura[nome] = Number(valor.toFixed(2));
  }

  if (!Object.keys(leitura).length) return null;

  const quando = new Date(dados.created_at);
  leitura.lidoEm = Number.isNaN(quando.getTime()) ? new Date() : quando;
  leitura.canalId = String(dados.channel_id ?? canalPadrao);
  return leitura;
}

async function tratarMensagem(topic, payload) {
  const leitura = interpretarMensagem(payload);
  if (!leitura) {
    console.warn('[mqtt] mensagem ignorada:', payload.toString().slice(0, 200));
    return;
  }

  const { canalId, lidoEm, ...medidas } = leitura;
  // upsert: se o broker reenviar a mesma leitura, não duplica
  await Leitura.updateOne({ canalId, lidoEm }, { $setOnInsert: medidas }, { upsert: true });
}

module.exports = { interpretarMensagem, tratarMensagem };
