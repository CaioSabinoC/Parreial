# Segurança do Parreiral (Cibersegurança — Prof. Ronierison, Senac)

**Código de missão:** `TESTE1`
**Equipe:** **Equipe:** Marcos Vinícius (MarcosVinicius-SS), Caio Sabino (CaioSabinoC), Arthur Vinicius (viniciussna), Thauan Bezerra (Thauan-rgb), Pedro Rodrigues (Pedrorgbgrdg)

Dois controles aplicados ao back-end do PI (Parreiral, Node/Express/MongoDB):

1. **2FA com OTP** no login (TOTP de 6 dígitos, QR Code, códigos de recuperação).
2. **Proteção contra IDOR**: cada usuário só vê, altera e comanda os próprios dados e dispositivos.

## Onde cada controle entra

| Controle | Onde | Arquivos principais |
|---|---|---|
| OTP | `POST /auth/login` (senha) e `POST /auth/otp/verificar` (código). Painel/app: login em 2 etapas. | `src/services/authService.js`, `src/seguranca/totp.js`, `src/seguranca/cripto.js`, `src/middlewares/autenticar.js` |
| IDOR | `/safras/:id` (+ `/encerrar`, `/previsao`, `/previsoes`), `/dispositivos/:id` (+ `/comandos`), `/leituras` (+ `/ultima`, `/resumo`) | `src/middlewares/dono.js`, `src/routes/*Routes.js`, `src/services/leituraService.js`, `src/services/previsaoService.js` |

## Como o OTP funciona

1. `POST /auth/registrar` cria o usuário e devolve o **QR Code**. O segredo do OTP fica **cifrado** (AES-256-GCM) no banco.
2. O usuário escaneia no Google Authenticator/Authy e confirma com o primeiro código em `POST /auth/otp/confirmar`. Só aí o OTP é ativado e saem **10 códigos de recuperação** (mostrados uma vez; no banco fica só o hash).
3. Login: `POST /auth/login` confere a senha e devolve só um **token parcial**, que **não acessa a API**. `POST /auth/otp/verificar` confere o código no servidor e só então devolve o **token de acesso**.
4. Regras: cada código vale uma vez (anti-reuso), 5 erros seguidos bloqueiam a conta por 15 min, código de recuperação vale uma vez, `POST /auth/recuperacao/regenerar` gera 10 novos (exige código OTP atual).

## Como o IDOR é bloqueado

- Toda rota da API exige o token de acesso (`autenticar`). O dono vem **do token**, nunca do corpo nem da URL.
- `safraDoDono` e `dispositivoDoDono` fazem a consulta `findOne({ _id, donoId })`. Se não for dono, responde **404** e registra `IDOR_BLOQUEADO` no log.
- `canaisPermitidos` limita as leituras aos canais dos dispositivos do usuário (sem filtro = só os dele).
- Os serviços também filtram por dono (defesa em profundidade): `calcularPrevisao(safraId, donoId)`.
- O corpo da requisição não define dono nem status (`donoId` enviado é ignorado).

## Como rodar e repetir os testes

```bash
npm install
cp .env.example .env     # preencha CODIGO_MISSAO, JWT_SECRET, OTP_CHAVE, MONGODB_URI
npm test                 # unitários + integração (usa banco separado "parreiral_teste")
npm start                # sobe a API (terminal 1)
```

Scripts de **antes e depois** (terminal 2, com a API rodando). Cada um grava o log em `seguranca/evidencias/` com o código de missão no nome:

```bash
node seguranca/testes/otp.js  --fase=antes     # no código ORIGINAL (sem o controle)
node seguranca/testes/otp.js  --fase=depois    # no código com o controle
node seguranca/testes/idor.js --fase=antes
node seguranca/testes/idor.js --fase=depois
```

Os scripts usam só dados sintéticos (e-mails `@sintetico.test`). Mais detalhes em `evidencias/README.md`.

## Alterações ao vivo (onde mexer)

- **Mudar a janela de validade do OTP:** `OTP_JANELA` no `.env` (padrão 1 = ±30 s). Lido em `src/config/env.js`, usado em `authService.consumirTotp`.
- **Terceiro usuário que não vê os dispositivos dos outros:** `node seguranca/testes/idor.js --fase=depois` ou `POST /auth/registrar` + `POST /dispositivos`.
- **Proteger uma rota nova:** montar a rota atrás de `autenticar` (em `app.js`) e usar `safraDoDono`/`dispositivoDoDono` na rota com `:id`.

## Limitações conhecidas

- Quem cadastrar primeiro o `canalId` de um dispositivo vira o dono dele (não há prova de posse do canal do ThingSpeak).
- O comando ao dispositivo é só registrado; ainda não é enviado ao MQTT.
- Safras criadas antes do controle não têm dono e ficam invisíveis até serem migradas.
- Não há limite de requisições por IP, só bloqueio por conta.
- O token JWT não pode ser revogado antes de expirar (60 min).
- Resposta 423 (conta bloqueada) revela que o e-mail existe.
- Em produção é obrigatório HTTPS; sem ele senha e código trafegam em claro.
- Mensagens MQTT/ThingSpeak e as leituras gravadas pelo MQTT não passam por este controle (entram por canal, não por usuário).
