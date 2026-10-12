function naoEncontrado(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada' });
}

// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  if (err.name === 'CastError') return res.status(400).json({ erro: 'Identificador inválido' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ erro: status >= 500 ? 'Erro interno do servidor' : err.message });
}

module.exports = { naoEncontrado, tratarErros };
