# Motor e origem dos arquivos

O Stockfish Lens empacota os arquivos `stockfish-19-lite-single.js` e `stockfish-19-lite-single.wasm` **sem alteração**, vindos de `stockfish@19.0.1` no npm. A versão está fixada em `package-lock.json`.

O submódulo `vendor/stockfish.js` aponta para a tag upstream **v19.0.1**, revisão **0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6**, de [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js/tree/v19.0.1). Esse repositório contém o C++ do Stockfish e as adaptações e scripts de WebAssembly usados por essa distribuição. Não é necessário clonar um segundo checkout C++ para compilar a extensão.

## Compilar a extensão

`npm ci && npm run build` copia os binários fixados do npm. Não executa uma compilação C++ nem depende de Emscripten. `dist/BUILD-INFO.json` registra a versão da extensão, a origem do motor e os hashes dos dois arquivos empacotados.

## Recompilar o motor, opcionalmente

O upstream especifica **Emscripten 6.0.9**. Com essa ferramenta já instalada e ativada, o procedimento upstream para a variante usada é:

```sh
git submodule update --init --recursive
cp assets/engine/nn-61e7af4bb97d.nnue vendor/stockfish.js/src/
cd vendor/stockfish.js
node build.js --lite --single-threaded --strict-em-check
```

A rede lite está incluída em `assets/engine/`, com o nome que contém o prefixo de seu SHA-256. Os comandos acima documentam a receita upstream; a release da extensão distribui os binários do npm e não afirma que recompilou o C++ localmente ou reproduziu seus bytes bit a bit. Veja os detalhes em `vendor/stockfish.js/README.md` e `node vendor/stockfish.js/build.js --help`.

## Fontes e licenças

O ZIP completo de fontes da release inclui o código da extensão, o conteúdo do submódulo, a rede lite e os scripts. O ZIP automático **Source code** gerado pelo GitHub não inclui o conteúdo de submódulos; use o pacote `stockfish-lens-1.1.2-source.zip` ou um clone com `--recurse-submodules`.

O motor é GPL-3.0; a rede NNUE do arquivo oficial é CC0-1.0, com o texto preservado em `assets/engine/CC0-1.0.txt`. Os arquivos do upstream são mantidos sem alteração. As fontes tipográficas e chess.js têm licenças próprias preservadas no pacote. Consulte [NOTICE.txt](../NOTICE.txt) e [LICENSE](../LICENSE).

## Alternativa de execução interna

Quando a criação do Worker na iframe do site falha com um evento sem mensagem técnica, o painel solicita ao service worker um documento `offscreen.html`, com a razão `WORKERS`. O painel conecta-se diretamente a esse documento por `runtime.Port`; o service worker não permanece como intermediário. Cada conexão usa uma iframe `engine.html` e um Worker próprios, removidos quando a conexão termina.

O mesmo motor e os mesmos comandos UCI são usados nos dois caminhos. O worker não depende de APIs de extensão: a versão vem de `engine-config.json`, e o log continua no painel. `storage` e `offscreen` são as permissões declaradas; não é necessário acesso a outros sites.

O painel limita a espera de cada inicialização a 15 segundos, independentemente dos temporizadores do motor. O esgotamento na iframe ativa a alternativa interna; o esgotamento interno encerra a conexão e oferece uma nova tentativa. Pesquisas têm um prazo adicional de 10 segundos além do tempo configurado. Pausar e reiniciar invalidam os temporizadores e conexões anteriores. Uma recarga da extensão exige uma nova página; esse estado é detectado e apresentado com uma ação explícita de atualização.
