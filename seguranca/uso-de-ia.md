# Uso de IA

Código de missão: `TESTE1`

Declaração: o código dos dois controles (OTP e IDOR), os testes e os rascunhos destes documentos foram gerados com apoio do **Claude (Anthropic)**, a partir do enunciado da atividade e do código original do Parreiral. O que a equipe conferiu de verdade está na coluna da direita. **Cada pessoa preenche a sua linha, e só com o que fez.**

| Parte gerada com IA | Quem conferiu | O que conferimos |
|---|---|---|
| Núcleo do OTP (`totp.js`, `cripto.js`, `authService.js`) | Marcos | Rodou `npm test` (29 testes passando, com MongoDB real) e os scripts `otp.js --fase=antes` e `--fase=depois` contra a API local. |
| Verificação de dono (`dono.js`, rotas, serviços) | Caio | Leu o código, rodou os testes e revisou o Pull Request. |
| Testes (`test/`, `seguranca/testes/`) | Marcos | Executou `npm test` com MongoDB real sem falhas e gerou os logs de antes e depois em `seguranca/evidencias/`. |
| Documentos (`README`, `modelo-ameacas`) | Caio | Leu os documentos e corrigiu erros neles. |

Pontos que a IA verificou por conta própria (a equipe deve repetir): o TOTP bate com os vetores da RFC 6238; os testes de integração falham quando o controle é removido de propósito (mutação em `dono.js` e `autenticar.js`).
