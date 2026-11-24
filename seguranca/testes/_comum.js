// Utilitários dos scripts de teste (antes/depois). Só dados sintéticos.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')).map(([k, v]) => [k, v ?? true])
);
const fase = args.fase;
if (!['antes', 'depois'].includes(fase)) {
  console.error('Use: node seguranca/testes/<script>.js --fase=antes   ou   --fase=depois   [--url=http://localhost:3000]');
  process.exit(2);
}

const URL_BASE = args.url || `http://localhost:${process.env.PORT || 3000}`;
const CODIGO = process.env.CODIGO_MISSAO || 'SEM-CODIGO';
const linhas = [];
let falhas = 0;

function saida(texto) {
  const linha = `[${CODIGO}] ${texto}`;
  console.log(linha);
  linhas.push(linha);
}

// Registra uma verificação: "esperado" é o que o controle deve fazer nessa fase
function verificar(descricao, condicao, detalhe = '') {
  if (!condicao) falhas++;
  saida(`${condicao ? 'OK     ' : 'FALHOU '} ${descricao}${detalhe ? ` -> ${detalhe}` : ''}`);
}

async function chamar(metodo, caminho, corpo, token) {
  try {
    const r = await fetch(URL_BASE + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    let json = null;
    try { json = await r.json(); } catch { /* sem corpo */ }
    return { status: r.status, corpo: json };
  } catch (err) {
    console.error(`Não consegui falar com ${URL_BASE}. A API está rodando? (npm start)`);
    process.exit(2);
  }
}

function sufixo() {
  return Math.random().toString(36).slice(2, 8);
}

function finalizar(nome) {
  const pasta = path.join(__dirname, '..', 'evidencias');
  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, `${nome}-${fase}-${CODIGO}.log`);
  fs.writeFileSync(arquivo, linhas.join('\n') + '\n');
  console.log(`\nLog salvo em: ${path.relative(process.cwd(), arquivo)}`);
  process.exit(falhas ? 1 : 0);
}

module.exports = { fase, args, saida, verificar, chamar, sufixo, finalizar, CODIGO };
