// Parâmetros agronômicos da previsão.
// ATENÇÃO: os valores abaixo são PROVISÓRIOS. Confirme com fonte agronômica
// (ex.: Embrapa Semiárido) ou com um produtor da região e cite no trabalho.
module.exports = {
  // Temperatura-base para graus-dia da videira (°C)
  baseTempC: 10,

  // Graus-dia acumulados desde a poda até a colheita
  grausDiaColheitaPadrao: 1500, // PROVISÓRIO
  grausDiaPorVariedade: {
    // Syrah: 1500,
    // 'Cabernet Sauvignon': 1600,
  },

  // Faixas ideais (média diária). Fora da faixa, a nota cai linearmente
  // até 0 a uma distância igual à "tolerancia".
  faixas: {
    temperatura: { min: 20, max: 30, tolerancia: 8 },   // °C
    umidadeAr:   { min: 50, max: 75, tolerancia: 25 },  // %
    umidadeSolo: { min: 40, max: 70, tolerancia: 30 },  // % (após calibrar o sensor)
  },

  // Penalidade para dias de calor extremo
  estresseCalor: { tempMaxC: 38, fator: 0.8 },

  // Quantos dias recentes usar para estimar o ritmo de acúmulo de graus-dia
  janelaRitmoDias: 7,

  // Abaixo disso, a previsão é marcada como "baixa confiabilidade"
  coberturaMinima: 0.5,
};
