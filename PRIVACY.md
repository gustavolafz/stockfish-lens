# Privacidade

O Stockfish Lens analisa posições localmente no navegador. A extensão não tem servidor de análise, conta própria, telemetria ou anúncios e não envia posições a uma API externa.

## Dados lidos

A integração lê as peças e a lista de lances da página do Chess.com para reconstruir a posição. Também aceita um FEN informado pelo usuário. O histórico é enviado ao motor local para preservar regras como roque, en passant e repetição.

O log UCI permanece na memória da página, com até 3.000 mensagens. Ele só é exportado para um arquivo quando o usuário escolhe **Baixar log**. Uma nova página começa com um novo log.

## Dados salvos

`chrome.storage.local` guarda preferências de análise e aparência, visibilidade das setas e o tamanho e a posição do painel. Não há sincronização com uma conta da extensão. Remover a extensão remove seu armazenamento local conforme o comportamento do Chrome.

## Permissões e rede

O manifesto solicita `storage` e `offscreen` e injeta o conteúdo nas páginas de `chess.com` e `www.chess.com`. A extensão não pede acesso ao histórico de navegação, cookies, credenciais ou a outros sites. Abrir a página de atalhos do Chrome usa a API de abas sem solicitar leitura das abas.

A permissão `offscreen` permite executar o motor em um documento interno oculto quando ele não inicia na iframe do site. A conexão é separada por aba e encerrada quando a página é fechada. Não abre abas nem janelas de análise.

JavaScript, WASM, fontes e ícones usados na análise são empacotados na extensão. A instalação das dependências de desenvolvimento usa npm; isso é separado da análise no navegador. O tráfego normal do site Chess.com continua sob responsabilidade do próprio site.
