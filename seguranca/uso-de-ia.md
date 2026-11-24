# Uso de IA

Código de missão: `[PREENCHER]`

Declaração: o código dos dois controles (OTP e IDOR), os testes e os rascunhos destes documentos foram gerados com apoio do **Claude (Anthropic)**, a partir do enunciado da atividade e do código original do Parreiral. O que a equipe conferiu de verdade está na coluna da direita. **Cada pessoa preenche a sua linha, e só com o que fez.**

| Parte gerada com IA | Quem conferiu | O que conferimos (preencher) |
|---|---|---|
| Núcleo do OTP (`totp.js`, `cripto.js`, `authService.js`) | `[PREENCHER]` | `[PREENCHER: ex. rodei npm test, li o fluxo, testei com Google Authenticator no celular]` |
| Verificação de dono (`dono.js`, rotas, serviços) | `[PREENCHER]` | `[PREENCHER]` |
| Testes (`test/`, `seguranca/testes/`) | `[PREENCHER]` | `[PREENCHER]` |
| Documentos (`README`, `modelo-ameacas`) | `[PREENCHER]` | `[PREENCHER]` |

Pontos que a IA verificou por conta própria (a equipe deve repetir): o TOTP bate com os vetores da RFC 6238; os testes de integração falham quando o controle é removido de propósito (mutação em `dono.js` e `autenticar.js`).
