const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config/env');
const mqttClient = require('./mqtt/client');
const { naoEncontrado, tratarErros } = require('./middlewares/erros');
const { autenticar } = require('./middlewares/autenticar');

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

app.use('/auth', require('./routes/authRoutes'));

// Daqui para baixo, só com login completo (senha + OTP)
app.use('/leituras', autenticar, require('./routes/leituraRoutes'));
app.use('/safras', autenticar, require('./routes/safraRoutes'));
app.use('/dispositivos', autenticar, require('./routes/dispositivoRoutes'));

app.use(naoEncontrado);
app.use(tratarErros);

module.exports = app;
