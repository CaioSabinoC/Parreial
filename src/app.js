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

const api = express.Router();

api.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongo: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
    mqtt: mqttClient.estaConectado() ? 'conectado' : 'desconectado',
  });
});

api.use('/auth', require('./routes/authRoutes'));

// Daqui para baixo, só com login completo (senha + OTP)
api.use('/leituras', autenticar, require('./routes/leituraRoutes'));
api.use('/safras', autenticar, require('./routes/safraRoutes'));
api.use('/dispositivos', autenticar, require('./routes/dispositivoRoutes'));

// O front chama /api/...; o Nginx pode ou não remover o prefixo, então a API responde nos dois caminhos.
app.use('/api', api);
app.use('/', api);

app.use(naoEncontrado);
app.use(tratarErros);

module.exports = app;
