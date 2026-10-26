# Stockfish Lens

Extensão Chrome Manifest V3, em português, para estudar partidas contra bots no Chess.com. O motor Stockfish.js 19.0.1 roda localmente em uma iframe da extensão e num Worker WebAssembly.

## Estrutura e contratos

- O projeto é independente; nenhum script pode depender de uma pasta pai chamada `Stockfish` nem de arquivos fora do repositório.
- `src/position.js` reconstrói o FEN pelo histórico completo e valida as peças. Não adivinhe roque, en passant ou a vez de jogar a partir da imagem. Preserve os testes de promoções localizadas e pré-movimentos.
- `src/analysis.js` mantém um único resultado coerente entre `bestmove`, SAN, avaliação, variantes e seta. Avaliações são pelas brancas; WDL é pelo lado que joga.
- `src/content.js` injeta o painel numa Shadow DOM. `src/settings.js` define os valores aceitos e compartilhados com o popup. Toda nova preferência precisa de um controle com o mesmo ID no popup.
- O painel inicia minimizado no canto inferior direito; o layout salvo é restaurado ao expandir. Prefira preservar ajustes existentes.
- O modo de foco do Chess.com não é suportado na leitura automática. Documente esta limitação; não ignore a verificação do histórico para contorná-la.
- `vendor/stockfish.js` é um submódulo fixado em v19.0.1. Não atualize ou modifique o motor incidentalmente. Os binários usados vêm da versão exata do npm, sem alteração.
- `assets/icon.svg` é o desenho original; os PNGs ficam em `assets/icons`. Use `npm run icons` somente ao alterar o ícone. Os prints enviados pelo usuário ficam em `docs/images`.
- `dist`, `release`, `artifacts`, dependências e arquivos locais não entram no Git.

## Validação

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:ux
npm run package
npm run verify:package
```

`CHROMIUM_PATH` seleciona um Chromium instalado. As suítes usam fixtures locais sanitizadas, um perfil temporário e o WASM real; não dependem de login no Chess.com. Não declare validação no site autenticado ou por teclas físicas sem evidência. Testes de atalhos chamam o ouvinte real do service worker, pois o Chromium sem interface não aciona aceleradores nativos por injeção de teclas.

## Entrega

Mantenha `package.json`, `package-lock.json` e `manifest.json` na mesma versão. Atualize `CHANGELOG.md` e os documentos afetados. `npm run package` gera um ZIP instalável, um ZIP completo de fontes (incluindo o submódulo) e checksums SHA-256. Nunca inclua diretórios `.git`, credenciais ou dependências locais nesses pacotes.

Publicação, push e release dependem de autorização na conversa. Não confunda testes locais com CI remoto concluído. Preserve avisos de licença de todas as dependências.
