# Changelog

## 1.1.2 — 2026-10-28

- Usa um documento interno offscreen quando o Worker falha sem detalhe na iframe do site. Cada aba mantém sua própria análise e libera sua sessão ao fechar, sem depender de manter o service worker acordado.
- Limita a espera de inicialização pelo próprio painel, inclusive quando a iframe não responde. Após 15 segundos tenta o motor interno; uma pesquisa sem retorno também oferece recuperação.
- Pausa imediatamente e encerra o motor antes de salvar a preferência. Os controles não dependem do evento do armazenamento para atualizar.
- Detecta a perda de contexto após recarregar a extensão, remove sugestões antigas e oferece **Atualizar página**.
- O ícone circular do cabeçalho reinicia o motor. **Restaurar posição e tamanho** fica em **Aparência**.
- Mantém uma tentativa automática para erros temporários, confirma a inicialização antes de enviar comandos e evita ciclos de reinicialização quando a falha persiste.
- Registra a causa técnica da falha, a versão da extensão e o navegador em **Motor e registros**.
- Adiciona ao CI testes de inicialização e pesquisa sem resposta, armazenamento travado, recarga real da extensão, isolamento entre abas e recuperação com o WASM real.

## 1.1.0 — 2026-10-26

- Atualiza os dois prints do README com as novas capturas da interface.

- Mini barra de avaliação na seção do melhor lance, com brancas à esquerda, pretas à direita e marca de equilíbrio no centro.
- A barra acompanha o mesmo resultado do valor numérico, mantém a perspectiva das brancas e indica mate e empate. Fica oculta quando não há avaliação disponível ou a análise foi pausada.
- Escala visual separada das probabilidades WDL, com explicação ao passar o mouse e rótulo de acessibilidade.

## 1.0.0 — 2026-10-25

Primeira entrega pública do Stockfish Lens, voltada ao estudo de partidas contra bots no Chess.com.

- Projeto independente, com fontes e scripts na raiz do repositório.
- Motor Stockfish.js 19.0.1 local, fixado no npm e no submódulo.
- Melhor lance, até cinco variantes, avaliação, WDL, métricas e log UCI.
- Três setas configuráveis, atalhos e filtro de alternativas desfavoráveis.
- Notação numerada, símbolos e letras das peças, com captura, promoção, xeque e mate destacados.
- Painel que inicia minimizado no canto inferior direito, com posição, tamanho e fontes ajustáveis.
- Reconhecimento dos pré-movimentos dos HTMLs testados sem interromper a análise da posição real.
- Ícone próprio, prints reais, guia de instalação, documentação de privacidade e CI.
- Pacotes versionados de instalação e fontes completos, com checksums SHA-256.

**Limitação conhecida:** mantenha o modo de foco do Chess.com desligado para disponibilizar o histórico de lances. A integração automática cobre xadrez padrão; não cobre Chess960 nem históricos incompletos. Durante uma prévia de pré-movimento reconhecida, o painel continua analisando e as setas ficam temporariamente ocultas.

O [histórico de desenvolvimento 0.x](docs/CHANGELOG-0.x.md) registra as correções e validações anteriores.
