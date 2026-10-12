# Análise em Python (fase 2)

Pasta reservada para os scripts de análise e para a calibração da previsão.

Plano: ao encerrar cada safra, o back guarda `colheitaRealKg`. Com algumas safras
encerradas, exporte as leituras + o rendimento real e use pandas/scikit-learn para:

1. substituir o valor padrão de graus-dia pela média observada;
2. ajustar os pesos do `fatorClima` por regressão (clima x rendimento real).
