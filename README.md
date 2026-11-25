# VinhaSense — Backend

Backend da plataforma **VinhaSense**, desenvolvida para monitoramento de condições ambientais de um parreiral e estimativa de produtividade e previsão de colheita.

O sistema recebe dados de sensores conectados a um ESP32, processa as informações, armazena as leituras e disponibiliza os dados por meio de uma API REST consumida pelo frontend.

## Equipe VinhaSense

- Arthur Vinicius
- Caio Sabino
- Marcos Vinicius
- Pedro Rodrigues
- Thauan Bezerra

## Arquitetura do sistema

O projeto utiliza um ESP32 equipado com sensores para monitoramento da temperatura, umidade do ar e umidade do solo.

As informações são enviadas ao ThingSpeak, que disponibiliza os dados por meio de MQTT. O backend recebe essas mensagens, interpreta as leituras e realiza o armazenamento no MongoDB.

O frontend consome a API REST para apresentar os dados em um painel de monitoramento.

```text
ESP32
 ├── DHT11
 │    ├── Temperatura
 │    └── Umidade do ar
 └── Sensor de umidade do solo
          │
          ▼
      ThingSpeak
          │ MQTT
          ▼
   Backend Node.js
       Express
          │
          ├── Processamento das leituras
          ├── Previsão de safra
          └── API REST
                │
                ▼
             MongoDB
                ▲
                │
          Frontend React
```

## Tecnologias utilizadas

- **Node.js:** ambiente de execução JavaScript.
- **Express 5:** criação da API REST.
- **MongoDB:** banco de dados NoSQL.
- **Mongoose:** modelagem e comunicação com o MongoDB.
- **MQTT:** comunicação com o ThingSpeak.
- **CORS:** configuração de acesso entre frontend e backend.
- **dotenv:** gerenciamento de variáveis de ambiente.
- **Nodemon:** reinicialização automática durante o desenvolvimento.

## Funcionalidades

- Recebimento de dados dos sensores por MQTT.
- Integração com o ThingSpeak.
- Armazenamento das leituras no MongoDB.
- Consulta de leituras por período.
- Consulta da última leitura recebida.
- Resumo de temperatura e umidade.
- Cadastro e gerenciamento de safras.
- Encerramento de safras com registro da produção real.
- Cálculo de estimativa de produtividade em quilogramas.
- Previsão de data de colheita.
- Histórico de previsões.
- Endpoint de monitoramento da API, MongoDB e MQTT.

## Estrutura do projeto

```text
Parreial/
├── src/
│   ├── config/
│   │   ├── env.js
│   │   └── parametrosVideira.js
│   ├── controllers/
│   │   ├── leituraController.js
│   │   └── safraController.js
│   ├── middlewares/
│   │   └── erros.js
│   ├── models/
│   │   ├── Leitura.js
│   │   ├── Previsao.js
│   │   └── Safra.js
│   ├── mqtt/
│   │   ├── client.js
│   │   └── handler.js
│   ├── routes/
│   │   ├── leituraRoutes.js
│   │   └── safraRoutes.js
│   ├── services/
│   │   ├── leituraService.js
│   │   └── previsaoService.js
│   ├── app.js
│   └── server.js
├── analytics/
├── test/
├── .env.example
├── package.json
└── README.md
```

## Requisitos

- Node.js 18 ou superior.
- MongoDB local ou MongoDB Atlas.
- Conta e configuração de dispositivo MQTT no ThingSpeak.

## Configuração e execução local

Clone o repositório:

```bash
git clone https://github.com/CaioSabinoC/Parreial.git
cd Parreial
```

Instale as dependências:

```bash
npm install
```

Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

Configure no `.env` os dados de conexão com o MongoDB e as credenciais MQTT do ThingSpeak.

Inicie em modo de desenvolvimento:

```bash
npm run dev
```

Para iniciar em produção:

```bash
npm start
```

Para executar os testes:

```bash
npm test
```

Caso as credenciais MQTT não estejam configuradas, a API pode iniciar sem o subscriber MQTT, conforme a configuração da aplicação.

**Importante:** não publique o arquivo `.env` nem compartilhe credenciais de acesso. Utilize `.env.example` como referência de configuração.

## Variáveis de ambiente

As principais configurações estão documentadas em `.env.example`.

| Variável | Finalidade |
|---|---|
| `PORT` | Porta HTTP da API |
| `CORS_ORIGIN` | Origem autorizada para acesso à API |
| `MONGODB_URI` | Conexão com o MongoDB |
| `MQTT_ENABLED` | Habilita ou desabilita a integração MQTT |
| `MQTT_HOST` | Endereço do broker MQTT |
| `MQTT_PORT` | Porta de comunicação MQTT |
| `MQTT_PROTOCOL` | Protocolo de conexão |
| `MQTT_CLIENT_ID` | Identificador do cliente MQTT |
| `MQTT_USERNAME` | Usuário MQTT |
| `MQTT_PASSWORD` | Senha MQTT |
| `THINGSPEAK_CHANNEL_ID` | Identificador do canal ThingSpeak |
| `FIELD_TEMPERATURA` | Campo da temperatura |
| `FIELD_UMIDADE_AR` | Campo da umidade do ar |
| `FIELD_UMIDADE_SOLO` | Campo da umidade do solo |
| `SOLO_RAW_SECO` | Referência de calibração do solo seco |
| `SOLO_RAW_MOL
| `CODIGO_MISSAO` | Código de 6 caracteres enviado pelo professor (obrigatório) |
| `JWT_SECRET` | Texto aleatório com 32 ou mais caracteres, usado para assinar os tokens (obrigatório) |
| `OTP_CHAVE` | 64 caracteres hexadecimais, usados para cifrar os segredos do OTP (obrigatório) |

## Segurança (OTP + IDOR)

A API agora exige login em 2 etapas (senha + código de app autenticador) e cada usuário só acessa os próprios dados. Detalhes, testes e limitações em [`seguranca/README.md`](seguranca/README.md). Rotas novas: `/auth/*` e `/dispositivos`.

Variáveis de ambiente obrigatórias (sem elas a API não sobe):

| Variável | Finalidade |
|---|---|
| `CODIGO_MISSAO` | Código de 6 caracteres enviado pelo professor |
| `JWT_SECRET` | Texto aleatório com 32 ou mais caracteres, usado para assinar os tokens |
| `OTP_CHAVE` | 64 caracteres hexadecimais, usados para cifrar os segredos do OTP |