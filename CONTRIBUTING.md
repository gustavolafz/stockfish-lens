# Contribuindo

Veja os comandos de instalação e desenvolvimento no [README](README.md) e os contratos do código em [AGENTS.md](AGENTS.md).

Ao reportar um problema, informe a versão da extensão, a versão do Chrome/Edge, se está em **Jogar com bots**, e mantenha o modo de foco desligado. Descreva os passos, o comportamento esperado e o observado. Quando possível, anexe um FEN ou log UCI exportado pelo painel, sem dados que você não queira publicar.

Para alterar a integração do site, use HTMLs de teste contendo apenas tabuleiro e lances. Não adicione dados de contas, cookies, tokens ou páginas completas autenticadas. Prefira testes que reproduzam o problema real.

Antes de abrir uma proposta, execute `npm test`, `npm run build` e a suíte de navegador relevante. Mudanças de aparência também devem passar por `npm run test:ux`. Para empacotar, inicialize o submódulo e execute `npm run package` e `npm run verify:package`.

Os ícones PNG são versionados e podem ser recriados a partir do SVG com `npm run icons`. O motor está fixado no npm e no submódulo; alterações nessa dependência devem ser explícitas e incluir a revisão de fontes, licença e pacotes.
