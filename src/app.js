const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config/env');
const mqttClient = require('./mqtt/client');
const { naoEncontrado, tratarErros } = require('./middlewares/erros');

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongo: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
    mqtt: mqttClient.estaConectado() ? 'conectado' : 'desconectado',
  });
});

app.use('/leituras', require('./routes/leituraRoutes'));
app.use('/safras', require('./routes/safraRoutes'));

app.use(naoEncontrado);
app.use(tratarErros);

module.exports = app;
