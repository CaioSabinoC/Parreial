# Modelo de ameaças

Código de missão: `[PREENCHER]`

| # | Ameaça | Como acontece | Controle | O que sobra (risco residual) |
|---|---|---|---|---|
| 1 | Senha roubada ou vazada | Phishing, reuso de senha, vazamento | OTP: a senha sozinha só gera token parcial, que não acessa a API | Quem também roubar o celular/segredo do OTP entra |
| 2 | Força bruta no código OTP | Testar os 1.000.000 códigos de 6 dígitos | Bloqueio da conta após 5 erros seguidos (15 min) | Bloqueio pode ser usado para travar a conta de outra pessoa; sem limite por IP |
| 3 | Reuso ou interceptação de um código | Atacante vê um código válido e tenta usar de novo | Cada passo de 30 s só vale uma vez (`otpUltimoPasso`, atômico); janela curta | Dentro dos 30 s o atacante pode usar o código **antes** da vítima |
| 4 | IDOR: trocar o ID na requisição | Usuário B pede `/safras/<id de A>` ou comanda `/dispositivos/<id de A>` | Dono conferido no servidor com `{_id, donoId}`; 404 e log `IDOR_BLOQUEADO` | Quem cadastra primeiro um `canalId` fica com ele (sem prova de posse) |
| 5 | Forjar dono ou identidade | Mandar `donoId` no corpo, adulterar o JWT, usar o token parcial como acesso | `donoId` vem só do token; JWT assinado (HS256) e com campo `tipo`; campos do corpo em lista permitida | JWT não é revogável antes de expirar; se `JWT_SECRET` vazar, tudo cai |

Dados sensíveis: o segredo do OTP é cifrado no banco (AES-256-GCM); códigos de recuperação e senhas ficam só como hash; nenhum segredo vai para o repositório (`.env` está no `.gitignore`).
