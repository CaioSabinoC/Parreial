# Evidências

Gere **na sua máquina**, com o código de missão real no `.env` (o nome dos arquivos leva o código). Não commite logs gerados com `TESTE1`.

1. **Antes** (no código original, ainda sem os controles; commite antes de aplicar os controles):
   `node seguranca/testes/otp.js --fase=antes` e `node seguranca/testes/idor.js --fase=antes`
2. **Depois** (com os controles): `npm start` em um terminal e, em outro,
   `node seguranca/testes/otp.js --fase=depois` e `node seguranca/testes/idor.js --fase=depois`
3. **Log do servidor** com os bloqueios: salve o terminal do `npm start` (copie as linhas `IDOR_BLOQUEADO` e `CONTA_BLOQUEADA`) em `servidor-CODIGO.log`.
4. **Vídeos de até 90 s**, com o código no nome (`otp-CODIGO.mp4`, `idor-CODIGO.mp4`): mostrar o antes, o depois e uma tentativa de contorno (OTP: código reutilizado ou 5 erros; IDOR: B trocando o ID de A).
5. **Prints** do QR Code e do app autenticador (sem mostrar segredos reais).

Arquivos gerados pelos scripts: `otp-antes-CODIGO.log`, `otp-depois-CODIGO.log`, `idor-antes-CODIGO.log`, `idor-depois-CODIGO.log`.
