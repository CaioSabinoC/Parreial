# Parreiral Back

Back-end do projeto de IoT de monitoramento de parreiral: um **ESP32** com sensor **DHT11** (temperatura e umidade do ar) e sensor de **umidade do solo** envia dados ao **ThingSpeak**; este serviço recebe as leituras por **MQTT**, guarda no **MongoDB**, permite **cadastrar safras** e calcula a **previsão de colheita** (quantidade em kg e data).

```
ESP32 ──► ThingSpeak ──MQTT──► Back (Node/Express) ──► MongoDB
                                      │
                                      └── API REST ──► Front (painel)
```

## Requisitos

- Node.js 18 ou superior
- MongoDB (local ou MongoDB Atlas)
- Um dispositivo MQTT criado no ThingSpeak (Devices → MQTT) com acesso ao canal

## Como rodar

```bash
npm install
cp .env.example .env     # preencha MONGODB_URI e as credenciais do MQTT
npm run dev              # desenvolvimento (nodemon)
npm start                # produção
npm test                 # testes do interpretador de mensagens MQTT
```

Sem as credenciais MQTT, a API sobe normalmente e o subscriber fica desligado (aparece um aviso no log). Útil para desenvolver o resto sem o ThingSpeak.

## Variáveis de ambiente

Veja `.env.example`. As principais: `MONGODB_URI`, `MQTT_CLIENT_ID`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `THINGSPEAK_CHANNEL_ID` e `CORS_ORIGIN`. Os campos `FIELD_*` dizem em qual field do canal está cada sensor.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Estado da API, do Mongo e do MQTT |
| GET | `/leituras?inicio=&fim=&limite=` | Leituras por período (padrão: últimas 24 h) |
| GET | `/leituras/ultima` | Leitura mais recente |
| GET | `/leituras/resumo?periodo=dia\|semana` | Média, mínimo e máximo por sensor |
| POST | `/safras` | Cadastra uma safra |
| GET | `/safras?status=ativa` | Lista safras |
| GET | `/safras/:id` | Detalhe da safra |
| PATCH | `/safras/:id/encerrar` | Encerra e registra `colheitaRealKg` |
| GET | `/safras/:id/previsao` | Calcula (e salva) a previsão da safra |
| GET | `/safras/:id/previsoes` | Histórico de previsões da safra |
| GET | `/safras/previsao?inicio=&fim=` | Soma dos kg previstos para colheitas no período |

Exemplo de cadastro:

```json
POST /safras
{
  "nome": "Safra 1 - 2027",
  "variedade": "Syrah",
  "grausDiaColheita": 1500,
  "areaHa": 2.5,
  "dataPoda": "2027-01-10",
  "produtividadeBaseKgHa": 18000
}
```

## Como a previsão funciona (fase 1)

- **Data da colheita:** soma de **graus-dia** (temperatura média diária − 10 °C, quando positiva) desde a poda. Quando o acumulado atinge `grausDiaColheita` da safra, é hora de colher. O ritmo recente de acúmulo estima os dias restantes.
- **Quantidade (kg):** `áreaHa × produtividadeBaseKgHa × fatorClima`. O `fatorClima` (0 a 1) é a média diária de notas que comparam temperatura, umidade do ar e umidade do solo com faixas ideais, com penalidade para dias de calor extremo.
- Cada resposta traz `confiabilidade: "baixa"` quando menos de 50% dos dias da safra têm leituras.

**Limitações:** é uma estimativa por regra, não um modelo treinado. As faixas ideais e o valor de graus-dia em `src/config/parametrosVideira.js` são **provisórios** e devem ser confirmados com fonte agronômica. O DHT11 tem precisão modesta (±2 °C, ±5% UR). O sensor de solo precisa de calibração (veja `SOLO_RAW_*` no `.env.example`).

**Fase 2:** ao encerrar cada safra, o rendimento real fica guardado; com algumas safras é possível calibrar a previsão por regressão (pasta `analytics/`).

## Estrutura

```
src/
├── config/        env.js e parametrosVideira.js
├── models/        Leitura, Safra, Previsao (Mongoose)
├── mqtt/          client.js (conexão) e handler.js (interpreta e salva)
├── services/      leituraService, previsaoService
├── controllers/   leituraController, safraController
├── routes/        leituraRoutes, safraRoutes
├── middlewares/   erros.js
├── app.js         Express
└── server.js      sobe HTTP + MQTT
test/              testes do handler MQTT
analytics/         scripts Python (fase 2)
```

## Deploy

O subscriber MQTT precisa de um processo **sempre ligado**, então o back **não roda na Netlify** (que hospeda só o front estático e funções serverless). Use um serviço como Render ou Railway, com MongoDB Atlas. Configure as variáveis de ambiente no painel do serviço e ajuste `CORS_ORIGIN` para a URL do front.
