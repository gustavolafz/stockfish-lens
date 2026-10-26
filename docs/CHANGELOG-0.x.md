# Arquivo histórico de desenvolvimento 0.x

Este documento registra a organização e as validações anteriores à versão 1.0. Para instalação, caminhos e comandos atuais, use o [README principal](../README.md). Referências antigas a `chrome-extension/` e `artifacts/` são históricas.

# Stockfish Lens

Extensão Chrome Manifest V3 para o tabuleiro do Chess.com identificado no HTML fornecido. O Stockfish 19 roda localmente, em WebAssembly, sem servidor, chave de API ou download de código durante o uso.

## Instalar

1. Abra `chrome://extensions` no Chrome.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `chrome-extension/dist` deste projeto. Se recebeu o ZIP, extraia-o e selecione a pasta que contém `manifest.json`.
5. Recarregue a página do Chess.com que contém o tabuleiro.

O painel aparece minimizado no canto inferior direito; clique em **+** para expandir. A seta indica a origem e o destino do melhor lance. O ícone da extensão permite escolher seta, painel ou ambos; o tempo de pesquisa; e uma, três ou cinco variantes. O painel pode ser recolhido ou a análise pode ser pausada.

Para atualizar uma instalação existente, clique em **Recarregar** no cartão da extensão em `chrome://extensions` e recarregue também a página do Chess.com. Se instalou a partir de um ZIP, extraia a nova versão na mesma pasta antes de recarregar.

## Versão 0.4.6

O painel inicia **minimizado no canto inferior direito** a cada carregamento da página, inclusive quando já havia uma posição salva. Clique em **+** para expandir; nesse momento, a posição e o tamanho anteriores são restaurados. A análise e as setas continuam funcionando enquanto o painel está recolhido. Mover, redimensionar e restaurar o layout continuam disponíveis.

## Versão 0.4.5

Corrige a interrupção ao marcar pré-movimentos nos dois HTMLs fornecidos. O Chess.com já desloca a peça na representação visual, incluindo capturas, mas ainda não registra esse lance no histórico. A extensão agora reconhece os dois destaques vermelhos e exige que a diferença inteira do tabuleiro corresponda exatamente a um pré-movimento do lado que está aguardando. A busca usa exclusivamente o FEN e o histórico reais, com a vez de jogar e os direitos de roque originais. Também reconhece o deslocamento da torre num pré-roque e a peça escolhida numa pré-promoção.

Marcar ou cancelar um pré-movimento reconhecido preserva a busca quando o FEN real não mudou. O painel informa **Pré-movimento marcado** e continua mostrando a análise da posição real. As setas ficam temporariamente ocultas enquanto as peças representam a posição antecipada; voltam automaticamente quando o tabuleiro coincide com a posição real, ao cancelar ou executar a fila. O objetivo é evitar sugestões desenhadas sobre peças que já foram deslocadas apenas na prévia.

A recuperação exige histórico completo e válido, seleção na posição mais recente e correspondência exata da prévia. Cores ou estruturas diferentes das fornecidas e alterações adicionais não explicadas continuam sendo rejeitadas; a extensão não deduz um FEN a partir de peças deslocadas. Não foi necessário modificar as preferências de pré-movimento do Chess.com. Os testes usam cópias das peças, destaques e lances dos anexos, sem dados dos jogadores.

## Versão 0.4.4

Em **Aparência**, o controle **Tamanho das setas** permite escolher de **50% a 200%**, em passos de 25 pontos. **100% (padrão)** restaura o tamanho original. Ajusta a espessura e as pontas das três sugestões, mantendo a origem e a ponta alinhadas às casas. A preferência é independente do tamanho das fontes, é salva e se aplica imediatamente sem reiniciar a análise. O mesmo controle também está em **Visualização** no popup.

## Versão 0.4.3

O controle **Tamanho das fontes** fica em **Aparência** no painel e em **Visualização** no popup. Escolha de **80% a 150%**, em passos de 10 pontos; **100% (padrão)** restaura a tipografia original. O tamanho é compartilhado e salvo entre páginas e sessões, com aplicação imediata sem reiniciar a análise.

Ajusta todos os textos da extensão: títulos, rótulos, avaliações, variantes, símbolos das peças na notação, botões, campos, log e números das setas. As proporções entre títulos e conteúdo são preservadas. As fontes do site e a posição e o tamanho escolhidos para o painel são preservados; o conteúdo se reorganiza e continua com rolagem interna. As escolhas de setas se reorganizam conforme o espaço disponível.

A validação em Chromium compara os tamanhos calculados em 80%, 100% e 150%, verifica sincronização dos dois controles e persistência após recarregar o painel e o popup, além de verificar cortes nas fontes mínima e máxima em quatro tamanhos de tela/painel. Prévia do popup ampliado: `artifacts/font-size-popup-150.png`.

## Versão 0.4.2

O filtro **Ocultar alternativas desfavoráveis**, ativado por padrão em **Setas no tabuleiro**, oculta as setas do 2º e do 3º lances quando a avaliação favorece o adversário de quem tem a vez. Como os valores exibidos são sempre pelas brancas, isso significa valores abaixo de zero para as brancas e acima de zero para as pretas. Por exemplo, com as brancas jogando e avaliações `+0,31`, `+0,24` e `−0,08`, só as duas primeiras setas aparecem, se selecionadas.

A melhor sugestão permanece disponível mesmo em posições desfavoráveis. Todas as variantes e suas avaliações continuam no painel, com a numeração original; nenhum aviso é acrescentado ao tabuleiro. Uma pequena desvantagem não significa necessariamente um erro: o filtro usa o sinal da avaliação para reduzir as setas. Empates estimados, avaliações ausentes e limites inconclusivos não são ocultados. A regra também se aplica a avaliações de mate.

Desative o filtro no painel ou no popup para ver todas as setas selecionadas. A preferência é salva e não reinicia a pesquisa. Os atalhos continuam alternando as setas selecionadas, respeitando o filtro; a seção de setas informa quantas alternativas selecionadas foram ocultadas.

## Versão 0.4.1

Remove os círculos sobre as peças na origem das sugestões. As três setas continuam com suas cores, números e controles de visibilidade.

## Versão 0.4.0 — revisão de UX

O painel e o popup passam a compartilhar cores, tipografia e espaçamentos. A referência anterior tinha títulos e rótulos de métricas com os mesmos 10 px e a mesma cor. Agora os títulos de seção usam 15 px e peso 800, enquanto os rótulos usam 12 px e peso 500, com cores diferentes; em painéis estreitos, os títulos continuam maiores que o conteúdo. As seções têm cabeçalhos clicáveis de pelo menos 44 px, bordas e estados de foco arredondados.

As mudanças também incluem:

- **Ações sempre acessíveis:** Pausar/Retomar e Analisar/Reanalisar ficam numa barra fixa na base do painel, fora da rolagem. Os controles têm áreas maiores e indicam quando a análise está carregando, pesquisando, pausada ou concluída.
- **Informação organizada:** melhor lance destacado, origem da posição visível e perspectiva da avaliação ao lado do valor. As chances estimadas têm rótulos completos de Vitória, Empate e Derrota, percentuais e barra, indicando o lado a que se referem.
- **FEN com contexto:** erros aparecem no campo sem apagar a análise atual. Uma posição manual fica claramente identificada e tem uma ação direta para usar o tabuleiro. Copiar a posição fica na seção de posição; o log fica em Motor e registros.
- **Feedback separado:** copiar, baixar e restaurar exibem confirmações sem sobrescrever o estado da análise. A pausa remove coordenadas antigas. Estados sem posição ou sem variantes têm explicações.
- **Popup por assunto:** Análise, Visualização, Setas, Atalhos e Posição/tamanho. Preferências salvas têm confirmação visível, e setas ocultas ou análise pausada têm orientações próprias.
- **Painéis menores:** textos, cartões e controles se reorganizam, com rolagem interna e sem ocultar o cabeçalho ou as ações. Animações respeitam a preferência por movimento reduzido.

Prévia do painel: `artifacts/ux-panel-refined.png`; dados da pesquisa: `artifacts/ux-stats-refined.png`; popup: `artifacts/ux-popup-refined.png`; painel estreito: `artifacts/ux-mobile-refined.png`. Medidas da auditoria: `artifacts/ux-review.json`. Execute `npm run test:ux` para repetir a auditoria no Chromium (aceita `CHROMIUM_PATH`).

## Versão 0.3.1

Atalhos de teclado para as setas:

| Atalho padrão | Ação |
| --- | --- |
| `Alt + Shift + 1` | Alternar a seta do melhor lance |
| `Alt + Shift + 2` | Alternar a seta do 2º melhor lance |
| `Alt + Shift + 3` | Alternar a seta do 3º melhor lance |
| `Alt + Shift + 0` | Mostrar as três melhores setas; pressionar novamente oculta as três |

Os atalhos usam as mesmas preferências salvas do painel e do popup. Ativar uma seta reativa a análise se estiver pausada; se todas as setas estiverem ocultas, um atalho individual mostra apenas a seta solicitada. O 2º e o 3º lances ativam automaticamente pelo menos três variantes.

O popup mostra as combinações efetivamente registradas em **Atalhos de teclado** e oferece **Personalizar atalhos no Chrome**, que abre `chrome://extensions/shortcuts`. Se uma combinação não estiver registrada, aparece como **Não definido**. Os comandos funcionam com o Chrome em foco e atualizam as preferências compartilhadas entre abas. A extensão continua pedindo apenas a permissão de armazenamento.

## Versão 0.3.0

O painel pode ser movido arrastando o cabeçalho e redimensionado pela alça no canto inferior direito. Posição, largura e altura são salvas automaticamente e restauradas nas próximas páginas. O conteúdo se reorganiza dentro da nova largura e tem rolagem própria; o cabeçalho e a alça ficam acessíveis.

O botão `↺` no cabeçalho restaura a posição e o tamanho padrão. O popup também tem **Restaurar posição e tamanho do painel**. O painel se ajusta ao espaço disponível quando a janela diminui, sem perder a preferência para uma janela maior. Recolher e expandir preserva o tamanho escolhido. Mover ou redimensionar não reinicia a análise nem altera as setas do tabuleiro.

Também é possível usar o teclado: com foco no cabeçalho, as setas movem o painel; com foco na alça, alteram largura e altura. `Shift` aumenta o passo do ajuste. Prévia: `artifacts/panel-layout.png`.

## Versão 0.2.3

Os símbolos dos lances usam desenhos SVG próprios, com formas clássicas, acabamento em marfim para as brancas e grafite para as pretas. Rei, dama, torre, bispo e cavalo têm contornos contrastantes, detalhes internos e tamanhos proporcionais à fonte dos lances. As mesmas peças aparecem no lance principal, variantes, promoções e resposta esperada; o cavalo também aparece no cabeçalho e no popup. A opção de mostrar a letra junto do símbolo continua disponível.

Prévia de todas as peças em diferentes tamanhos: `artifacts/piece-icons.png`. Para gerar novamente após a build: `npm run preview:pieces` (aceita `CHROMIUM_PATH`). Os desenhos são empacotados no JavaScript e não dependem de imagens externas ou de fontes de símbolos.

## Versão 0.2.2

A notação mostra símbolo e letra juntos por padrão: `15. O-O ♛Q×b2 16. ♘Nd2 ♞Nf5`. As letras seguem o SAN: `K`, `Q`, `R`, `B`, `N`. Promoções também exibem os dois, por exemplo `e8=♕Q+`; peões e roques continuam sem letra adicional.

A opção **Símbolo + letra da peça** fica no popup e em **Notação dos lances** no painel. Desativá-la volta a mostrar somente símbolos. A preferência é salva e atualiza o lance principal, as variantes e a resposta esperada sem reiniciar a pesquisa.

## Versão 0.2.1

A notação diferencia captura `×` em dourado, promoção `=` e peça promovida em lilás, xeque `+` em dourado e mate `#` em rosa. O arquivo ou a fileira que identifica a origem de uma peça (`Rae1`, `R1e2`, `Nb1d2`) recebe destaque discreto, separado da casa de destino. Roques `O-O` / `O-O-O` têm sublinhado pontilhado, mantendo a notação original e sem ícone de peça. Os sinais têm explicações ao passar o mouse. Os estilos valem para o lance principal, as variantes e a resposta esperada.

## Versão 0.2.0

A interface e o popup usam Manrope; os lances usam Lora. As fontes são empacotadas na extensão, incluindo Noto Sans Symbols 2 para os símbolos de rei, dama, torre, bispo e cavalo. Peões e roques continuam sem símbolo adicional. As capturas aparecem como `×`, em outra fonte e cor; cheque e mate também recebem destaque. A notação SAN original continua disponível ao passar o mouse sobre um lance e nas informações de acessibilidade.

As continuações agora incluem o número real do lance obtido do FEN, por exemplo `15. O-O ♛×b2 16. ♘d2 ♞f5`. Se a posição começar pelas pretas, a linha começa com `15…`. O número da variante aparece em um selo separado da numeração da partida.

Em **Setas no tabuleiro**, no painel ou no popup, é possível ligar/desligar todas as setas e escolher separadamente o 1º, 2º e 3º lances. As cores são verde, dourado e azul, com números correspondentes no tabuleiro. As escolhas são salvas; a configuração inicial mostra somente a primeira seta. Ativar a segunda ou a terceira seta com apenas uma variante configurada aumenta automaticamente a pesquisa para três variantes. Alterar apenas a visibilidade das setas não reinicia a pesquisa. O modo **Só painel** oculta as setas; ativá-las pelos controles retorna ao modo **Painel + setas**.

## Versão 0.1.2

Corrige a divergência entre o lance principal, a seta e as variantes ao encerrar a busca. A resposta UCI `bestmove` agora seleciona um resultado único para texto, coordenadas, avaliação, continuação, métricas e seta. Resultados parciais com `lowerbound` / `upperbound` também são lidos; seus limites são mostrados como `≥` / `≤`, sempre pela perspectiva das brancas. A lista de variantes evita repetir o mesmo lance durante atualizações incompletas do MultiPV. Se o motor escolher um lance sem avaliação disponível, a extensão mostra `—` para esse valor, em vez de reutilizar a avaliação de outro lance.

## Versão 0.1.1

Corrige a interrupção da análise após uma promoção escrita em português no histórico do Chess.com: `a8=D` passa a ser convertido para o SAN `a8=Q` aceito pelo motor. Também converte `=T` em `=R` e `=C` em `=N`, mantendo a notação inglesa e as figuras do site. O caso reportado ocorreu no lance 43, e não por um limite de 40 lances.

## Dados disponíveis

- Melhor lance em SAN e coordenadas, incluindo promoção.
- Avaliação em centipawns convertida para peões, ou distância até mate. O sinal sempre segue a perspectiva das **brancas**. Os símbolos `≥` / `≤` indicam limites emitidos em uma pesquisa incompleta.
- Até cinco variantes MultiPV, com avaliação, profundidade e continuação completa.
- Probabilidades estimadas pelo modelo WDL de vitória / empate / derrota para **o lado que joga**, indicado no painel. Não são uma garantia de resultado.
- Profundidade principal e seletiva, posições pesquisadas, posições por segundo, tempo e ocupação do hash.
- Consultas a tablebases, carga de CPU e lance atual, quando o motor emitir esses campos. Esta build não inclui tablebases; campos que não forem emitidos ficam ausentes do painel.
- Resposta esperada do adversário (`ponder`), quando emitida.
- **Protocolo UCI completo**: comandos enviados e todas as respostas recebidas, inclusive identificação do motor, opções suportadas, mensagens de diagnóstico e campos sem representação visual. O buffer guarda as últimas 3.000 mensagens da página e pode ser baixado como `.txt`.
- Cópia do FEN e análise de um FEN manual.

O motor empacotado é a variante **Stockfish.js 19 lite-single**, com rede NNUE reduzida e uma thread. A rede reduzida pode produzir avaliações diferentes da versão completa. São usados 32 MiB de hash. A pesquisa é limitada pelo tempo selecionado; aumentar MultiPV divide esse tempo entre mais variantes.

## Leitura do Chess.com

A extensão lê `wc-chess-board` / `chess-board`, as classes `.piece`, `.square-XY`, o histórico `[data-node="0-N"]` e as figuras `[data-figurine]`. Reconstrói a partida desde a posição inicial e confere as peças do tabuleiro antes de pesquisar. Isso preserva vez de jogar, roque, en passant e o histórico enviado ao motor para reconhecer repetições.

Ao navegar por lances anteriores, usa o nó selecionado do histórico. Durante animações ou mudanças de posição, apaga a seta anterior e ignora respostas atrasadas do motor.

Se o histórico estiver incompleto, a posição começar por um FEN personalizado ou o site mudar seu HTML, a extensão informa que não conseguiu confirmar a posição. Abra **Analisar uma posição** e use **Analisar FEN** nesses casos. O FEN manual fica ativo até **Usar tabuleiro**; a seta só aparece se suas peças corresponderem às peças visíveis. A integração automática cobre xadrez padrão com histórico completo, sem suporte a variantes como Chess960.

As preferências ficam em `chrome.storage.local`. A extensão não faz pedidos de rede para analisar posições e não executa lances.

## Desenvolvimento

Requer Node.js 20+ e npm.

```sh
cd chrome-extension
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm run test:ux
npm run package
```

Para reutilizar um Chromium instalado:

```sh
CHROMIUM_PATH=/caminho/para/chrome npm run test:browser
```

O teste de navegador instala a extensão real em um perfil temporário, intercepta o endereço do Chess.com e serve uma fixture local extraída do tabuleiro e da lista de lances anexados. Ele executa o WASM empacotado, sem acessar uma conta ou partida real. A fixture não inclui dados da conta do HTML original.

## Validação executada

Em 25/10/2026: 27 testes unitários passaram. O teste com Chromium e a extensão instalada executa o Stockfish real e cobre variantes legais, WDL, métricas, log UCI, alinhamento em 1366, 900 e 390 px, tabuleiro invertido, entrada e saída de tela cheia, pausa/retomada, preferências do popup, navegação pelo histórico, mudanças rápidas de posição, histórico ausente, promoção por FEN, mate e afogamento.

Na versão 0.2.1, os testes verificaram separadamente promoção, xeque, mate, captura, indicação de origem e roques, incluindo o caso combinado `exd8=Q#`. No Chromium, uma promoção e um melhor lance que dá mate exibiram os destaques correspondentes; os testes de sincronização entre painel e seta também passaram.

Na versão 0.2.2, os 23 testes passaram novamente. O Chromium confirmou a exibição inicial de símbolo com letra, a troca para somente símbolos pelo popup e a reativação pelo painel, com a preferência sincronizada entre os dois controles.

Na versão 0.2.3, os 23 testes e a suíte do Chromium passaram com os novos SVGs, incluindo letras opcionais, promoções, variantes e sincronização da seta. A prévia das cinco peças, em ambos os lados e em três tamanhos, foi renderizada e inspecionada em `artifacts/piece-icons.png`.

Na versão 0.3.0, o Chromium confirmou arraste pelo cabeçalho, redução e ampliação pela alça, persistência após recarregar a página, preservação do tamanho ao recolher/expandir, ajuste à janela de 390 × 700, controles pelo teclado e restauração pelo painel e pelo popup. A suíte existente, incluindo tela cheia e sincronização entre lance e seta, também passou.

Na versão 0.3.1, passaram 27 testes unitários. No Chromium, os quatro atalhos foram registrados com as combinações padrão; o teste confirmou que o manipulador instalado é o ouvinte de `chrome.commands.onCommand` e o acionou no service worker real. A integração verificou atualização das setas, sincronização dos controles, acionamentos rápidos consecutivos e abertura da tela de personalização. A injeção de teclas do navegador sem interface não aciona os aceleradores nativos; por isso, não houve validação por teclado físico neste ambiente.

Na versão 0.4.0, os 27 testes unitários e a suíte funcional passaram. A auditoria adicional de UX no Chromium verificou títulos de 15 px/peso 800 contra rótulos de 12 px/peso 500, contraste medido de aproximadamente 13,1:1 nos títulos e 10:1 nos rótulos auditados, expansão pelo teclado, ações visíveis durante a rolagem e rótulos completos das chances estimadas. Também confirmou que FEN inválido preserva a análise, o modo manual fica explícito e os estados de pausa/pesquisa/conclusão atualizam os controles. Não houve transbordamento horizontal nos painéis de 392, 340 e 280 px nos quatro tamanhos de janela testados, nem no popup de 360 px. As duas suítes de navegador terminaram sem erros de página ou console na página instrumentada.

Na versão 0.2.0, o Chromium também confirmou o carregamento das três fontes locais, as fontes diferentes para interface e notação, símbolos das peças, capturas destacadas e numeração começando pelas brancas e pelas pretas. Os controles do painel e do popup ligaram/desligaram as três setas individualmente e pelo controle geral, e os destinos foram comparados com as variantes exibidas. A suíte completa terminou sem erros de página ou console. Prévia da interface: `artifacts/typography.png`; controles: `artifacts/preferences.png`.

A regressão da versão 0.1.1 foi reproduzida antes da correção usando o segundo HTML fornecido: a leitura parava em `43. a8=D`. Após a correção, o teste unitário reconstruiu os 87 meios-lances e conferiu o FEN final; o Chromium analisou essa posição e continuou atualizando sugestões legais antes, durante e após a promoção, incluindo `43...Rxb3 44.hxg4`.

A regressão da versão 0.1.2 também foi reproduzida antes da correção, repetindo as 47 mensagens UCI da última pesquisa no terceiro anexo: o motor terminava com `bestmove d8c7`, enquanto as coordenadas e variantes ainda mostravam `d8b6`. Após a correção, os testes unitários e a reprodução no Chromium confirmaram `Qc7`, `d8 → c7`, a primeira variante e o destino da seta sincronizados, com avaliação `≥+0.56`. A posição do terceiro anexo também foi pesquisada com o WASM real; a comparação entre os campos passou com o tabuleiro invertido.

Essa validação usa o DOM extraído do anexo. A instalação no Chrome do usuário e a integração com o site autenticado ao vivo ainda precisam ser verificadas nesse ambiente.

## Licenças e referências

Extensão sob GPL-3.0; chess.js sob BSD-2-Clause; fontes sob SIL OFL 1.1. O pacote inclui as licenças e `NOTICE.txt`. O ZIP de fontes acompanha o instalável.

- [Stockfish.js e builds para navegador](https://github.com/nmrugg/stockfish.js)
- [Código-fonte do motor 19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1)
- [Política de conteúdo para extensões Chrome e WebAssembly](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [Comandos e atalhos de teclado das extensões Chrome](https://developer.chrome.com/docs/extensions/reference/api/commands)
