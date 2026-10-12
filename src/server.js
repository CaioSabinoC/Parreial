const mongoose = require('mongoose');
const config = require('./config/env');
const app = require('./app');
const mqttClient = require('./mqtt/client');

async function main() {
  if (!config.mongoUri) throw new Error('Defina MONGODB_URI no arquivo .env');

  await mongoose.connect(config.mongoUri);
  console.log('[mongo] conectado');

  const server = app.listen(config.port, () => console.log(`[http] rodando na porta ${config.port}`));
  mqttClient.iniciar();

  const encerrar = async () => {
    console.log('Encerrando...');
    server.close();
    await mqttClient.encerrar();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
