# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Corrigido

- **Editar endereço › Localização:** arrastar ou fazer pinça no mapa movia a tela inteira (o gesto de fechar a janela arrastando); agora mexe só no mapa.
- **Janelas que fecham arrastando para baixo:** a pinça cancela o arrasto; "Deslizar para confirmar" (reiniciar/remover ONU) não move nem fecha a janela se o dedo descer; e listas com rolagem própria (edição de endereço, registrar cliente na ONU, janela do cliente) voltam a rolar para cima em vez de arrastar a janela.

## [1.30.1] - 2026-11-06

### Alterado

- **OS › Antes de finalizar** (antes "Pronto para fechar"): novo nome do quadro. Cada atalho abre a tela já no item: CTO → Conexão › CTO, Conexão → Conexão › Resumo, Sinal → ONU › Sinal, ONU → ONU › Equipamento (registrar cliente).

### Corrigido

- **ONU pelo PPPoE (OS, Conexão, Cliente e ONU):** a busca do Controllr é por trecho e trazia a ONU de outro cliente quando um PPPoE contém o outro (ex.: "silva@x" e "mariasilva@x"), mostrando sinal e "Registrada para" de outra pessoa no Antes de finalizar. Agora só vale o PPPoE exato.

## [1.30.0] - 2026-11-06

### Adicionado

- **Editar endereço:** miniatura do mapa (satélite) com o ponto do endereço e o círculo de precisão da captura, para conferir antes de salvar.
- **Editar endereço:** CEP com máscara; ao completar os 8 dígitos, preenche logradouro, bairro, cidade, UF e o código do município pelo ViaCEP (consultado pelo servidor). A UF continua livre para digitar, em maiúsculas.
- **Editar endereço:** fechar com alterações (Cancelar, toque fora, arrastar ou Voltar do celular) pede confirmação para descartar.
- **Endereço sem coordenada (cliente e OS):** botão "Marcar local", que abre a edição direto na aba Localização; também no "Pronto para fechar" da OS.

### Alterado

- **Editar endereço:** tela cheia em duas abas, Endereço e Localização, cada uma cabendo na tela sem rolar; o mapa ocupa o espaço livre. Salvar e Cancelar fixos no rodapé; UF em campo estreito ao lado da cidade.
- **Editar endereço › Localização:** usa a posição do técnico (na casa do cliente) amostrando o GPS por alguns segundos; termina assim que a precisão chega a 5 m (limite de 10 s), mostra a precisão melhorando durante a busca e avisa quando ela passa de 30 m.
- **Ações em cartões grandes:** "Editar" com texto no lugar do lápis, com os botões dividindo a largura do cartão. Telefone: Ligar / WhatsApp / Editar. Endereço do cliente e da OS: Editar / Ver no mapa (ou Marcar local). O lápis fica só onde o espaço é restrito (Renomear ONU).
- **Botões sozinhos em largura cheia:** Salvar Wi-Fi, Salvar acesso, Salvar observação, Salvar CTO, Carregar mais, Adicionar telefone e Ver contrato assinado.
- **Auditoria:** as senhas de acesso ao roteador e do Wi-Fi passam a ser gravadas e exibidas (anterior → nova). Registros antigos continuam só com "alterada".

### Corrigido

- **Auditoria:** salvar de novo a CTO, a observação, o acesso ao roteador ou o Wi-Fi sem mudar nada não gera mais um segundo registro.
- **OS:** "Rota" só na grade do topo (não se repete no cartão de endereço).
- **Editar endereço:** campos não ficam mais comprimidos.
- **Ferramentas:** texto em registro formal ("para").

## [1.29.0] - 2026-11-06

### Adicionado

- **Pronto para fechar (OS › Checklist):** confere ONU registrada para o cliente, sinal da ONU e da OLT na faixa, PPPoE conectado, CTO e porta gravadas e coordenada do endereço; o que falta vem com atalho para a ONU, a Conexão ou a edição do endereço.
- **Portas da CTO (Conexão › CTO):** portas livres para tocar e preencher, ocupadas com PPPoE, cliente e online/offline, aviso quando a porta digitada já é de outra conexão e quando há porta repetida ou conexão sem porta. Contrato cancelado ou desativado não ocupa porta.
- **Quedas recentes:** no cliente e na OS, selo "Caiu N vezes em 7 dias" (a partir de 3), com quantas foram por perda de link (fibra ou energia).

### Alterado

- **Registrar cliente na ONU:** busca por nome, CPF/CNPJ, contrato ou login PPPoE; atalho com o PPPoE já configurado na ONU; achado pelo PPPoE ou com uma só conexão, vai direto para a confirmação; mostra serial, OLT e posição da ONU, passos (Cliente, Conexão, Confirmar), contrato e CTO de cada conexão, resumo antes de associar e aviso quando o PPPoE escolhido difere do configurado na ONU; campos e itens com toque de 48px.
- **Busca de ONU:** itens em duas linhas com ícone; a ONU mostra o cliente (ou "Sem cliente"), a OLT e a posição, e o PPPoE mostra cliente, contrato e CTO.
- **Busca do Início:** resultados em duas linhas com ícone por tipo (ONU, PPPoE, cliente), toque de 56px, letra de 15px e lista mais alta; a ONU mostra cliente, OLT e posição, o PPPoE mostra cliente, contrato e CTO, e o cliente mostra CPF/CNPJ e quantas conexões tem.
- **Teclado:** escolher uma ONU na busca da tela ONU, um cliente no Mapa de CTOs ou uma CTO na Conexão fecha o teclado; no Mapa de CTOs, o cliente aparece em duas linhas com ícone.
- **Busca de PPPoE na Conexão:** itens com cliente, contrato e CTO.
- **Renomear ONU:** atalho "Usar o PPPoE" com o login configurado na ONU, em maiúsculo.
- **Toque de 48px:** campos e botões dos cartões da Conexão, lista de CTOs, Editar endereço, abas, ações de contato, Clientes Offline, Auditoria, OS do dia e visualizador de imagem do chamado; campos com letra de 16px.

## [1.28.0] - 2026-11-05

### Adicionado

- **Traçado do cliente até a CTO:** no Mapa de CTOs e no bloco CTO da Conexão, uma linha tracejada liga o endereço do cliente à CTO, com o nome, a porta e a distância em linha reta; o mapa enquadra os dois pontos.
- **Clientes Offline como diagnóstico:** alerta das CTOs com mais de um cliente offline (provável fibra, CTO ou splitter), que filtra a lista ao tocar.
- **Clientes Offline por tempo de queda:** grupos Caiu hoje, De 1 a 7 dias, Mais de 7 dias e Nunca conectou, com "caiu há X" e a última conexão com data e hora — a queda é o último accounting da sessão, não a última autenticação.
- **Ações no cartão do offline:** CTO em destaque com cor, porta e selo "N nesta CTO", e os botões Conexão, ONU, Mapa, Ligar e Cliente numa linha só.
- **Mapa no cliente, na OS e na ONU:** abre o Mapa de CTOs com o cliente e o traçado até a CTO dele.
- **Início:** o atalho de Clientes Offline mostra também quantas CTOs têm mais de um offline.
- **Conexão › Rede:** "Última conexão" (último accounting, a hora da queda quando o cliente está offline) além da "Última autenticação"; no cliente, a conexão sem sessão mostra quando caiu.

### Alterado

- **Atualizar o app não derruba mais ninguém:** as sessões ficam gravadas cifradas no servidor e voltam depois da atualização; o usuário de consulta dos avisos de OS também deixa de sair e entrar no Controllr a cada atualização.
- **Mapa mais fluido:** as CTOs não são redesenhadas a cada leitura do GPS, e o "Você" e o círculo de precisão só mudam de lugar.
- **Localização mais precisa:** sempre leitura nova do GPS; qualquer melhora de 1 m na precisão aparece na hora, assim como movimentos a partir de 3 m.
- **Mapa mais limpo:** legenda dentro do mapa, e Ampliar e Google Maps como botões no canto superior direito, ao lado da localização.
- **Visual padronizado:** só ícones Lucide, em três tamanhos, com o mesmo ícone por área em todas as telas (Conexão, ONU, OS e Cliente).
- **Mesma grade de ações** (ícone em cima, nome embaixo) no topo da OS, nas conexões do cliente e em Clientes Offline, e o mesmo botão de ícone com área de toque de 48 px.
- **Filtros no mesmo formato** (número em destaque e nome) em Clientes Offline, na lista de OS (com "Atrasadas" em vermelho) e na Auditoria.
- **Datas e atualização:** formato "há 3 h · 05/11/2026 19:25" e "Atualizado há X" em Clientes Offline, OS, Financeiro e Auditoria.
- **Telas de carregamento e de erro padrão** no Mapa de CTOs e na Auditoria, com "Tentar de novo".

### Segurança

- **Login:** o bloqueio por senha errada passa a ser por aparelho (IP) e usuário juntos, mais um limite por IP — ninguém consegue mais travar a conta de outro técnico errando a senha dele de propósito.
- **Dependências do servidor atualizadas** (FastAPI, Starlette, Uvicorn, aiohttp, Pydantic e python-multipart).
- **Menos exposição:** o servidor não informa mais versão nem nome do programa para fora, e sair do app apaga os clientes buscados recentemente guardados no celular.
- **Build e testes automáticos** no GitHub a cada envio.

## [1.27.0] - 2026-11-05

### Adicionado

- **CTO atual do cliente no Mapa de CTOs:** ao buscar um cliente, aparecem a
  CTO e a porta já gravadas na conexão dele (com o PPPoE, se tiver mais de
  uma); tocar mostra a CTO no mapa, e ela ganha o selo "Atual" na lista.

## [1.26.0] - 2026-11-05

### Adicionado

- **Mapa de CTOs:** novo atalho no Início abre o mapa com todas as CTOs e a
  sua localização ao vivo, com a lista das 5 CTOs mais próximas, a distância
  e a ocupação (ex.: 13/16 portas · 3 livres, ou Lotada). Tocar numa CTO a
  destaca no mapa.
- **CTO mais próxima do cliente:** a busca do Mapa de CTOs (igual à do
  Início) leva ao endereço do cliente e passa a medir as distâncias a partir
  dele, para conferir a CTO antes de ir ao local.

### Alterado

- **Próximas OS:** sem OS agendadas, o atalho mostra só "Nenhuma agendada".

## [1.25.0] - 2026-11-05

### Adicionado

- **Auditoria de CTO e observação da conexão:** trocar CTO ou porta da CTO e
  editar a observação da conexão passam a aparecer na Auditoria, com quem
  fez, o IP e o antes → depois (CTO pelo nome), além do cliente e do PPPoE.
- **Auditoria das etapas da OS:** responder, iniciar e finalizar a OS, e
  desfazer cada uma dessas etapas, entram na Auditoria com o chamado e a
  descrição ou o motivo.
- **Auditoria da liberação financeira:** a observação de liberação de
  fatura registra cliente, fatura, prazo (data ou dias) e o texto.
- **Auditoria de Atualizar ONU e de entrada no app:** atualizar os dados da
  ONU (que reconecta a OLT) e cada login com sucesso, com o IP de origem.
- **Filtros da Auditoria:** novas opções para CTO e porta, Observação,
  Atualizações da ONU, Liberações financeiras, cada etapa da OS, Etapas
  desfeitas e Entradas no app.

## [1.24.0] - 2026-11-05

### Adicionado

- **Mensagem e anexo no chamado:** com o chamado aberto, o técnico volta a
  poder enviar mensagem de texto e anexo (tirar foto, galeria ou arquivo)
  pela tela do Suporte; foto grande é reduzida antes de subir.

### Corrigido

- **Atalhos do Início:** a descrição (ex.: "Nenhuma agendada para os
  próximos dias") quebra linha em vez de ser cortada com "…".
- **Botões sem degradê:** Enviar do chamado, Buscar cliente, botão verde do
  cliente e o da tela de erro passam a ter cor sólida, como os demais
  botões do app.

## [1.23.3] - 2026-11-05

### Alterado

- **Teclado nos campos, como em app nativo:** buscas com a tecla "Buscar";
  PPPoE, serial, CTO, login e senhas de roteador e Wi-Fi sem maiúscula nem
  correção automática; telefone com teclado de telefone e CEP com teclado
  numérico.

### Corrigido

- **"Voltar" depois de buscar na Conexão e na ONU:** escolher o resultado
  troca a busca (não empilha); "Voltar" sai da aba em vez de reabrir a busca
  anterior.
- **Abas do rodapé no jeito de app nativo:** trocar de aba não empilha telas;
  "Voltar" de qualquer aba leva ao Início e, no Início, sai do app. Tocar na
  aba atual, estando numa tela aberta dela, volta ao começo da aba.
- **"Voltar" do celular com janela aberta:** fecha a janela (confirmação de
  etapa, Configurações, câmera, leitor de código, edição de telefone e
  endereço, ações da ONU etc.) em vez de sair da tela por baixo dela.
- **Tela de trás rolando com janela aberta:** com modal, folha ou câmera na
  frente, a tela de trás fica parada.
- **Realce preso em itens de lista:** o destaque de "passar o mouse" só vale
  em aparelho com mouse; no toque, não fica marcado depois de tocar.

## [1.23.2] - 2026-11-05

### Alterado

- **Botões do topo da OS:** Rota, Ligar, WhatsApp e Chamado numa grade de
  colunas iguais, com o ícone sobre o rótulo ("Ver chamado" passa a ser o botão
  "Chamado"). Com mais de um telefone, o número aparece embaixo de "Ligar".

### Corrigido

- **Menu do navegador ao segurar o dedo:** em botões e links (OS, Rota etc.)
  o menu "Abrir em nova guia/Copiar link" não aparece mais; só nos campos de
  entrada de dados.
- **Etiquetas de etapa apagadas em OS / Suporte:** depois de abrir um chamado,
  Agendada, Respondida e Em andamento ficavam com texto branco sobre o tom
  claro; agora mantêm a cor.

## [1.23.1] - 2026-11-05

### Alterado

- **Seleção de texto:** em todo o app, o texto não seleciona ao segurar; só os
  campos de entrada de dados (busca, descrição, login etc.) continuam
  selecionáveis.

## [1.23.0] - 2026-11-05

### Corrigido

- **Aviso cobrindo o botão de etapa:** com a barra de ação no rodapé da OS, o
  aviso aparece acima dela.

## [1.22.0] - 2026-11-04

### Adicionado

- **Números do dia em destaque e clicáveis no Início:** Abertas,
  Atrasadas e Concluídas em cartão claro com o número na cor da marca;
  Abertas e Atrasadas abrem a tela de OS já filtrada (Concluídas não tem
  lista: a tela de OS só traz OS em aberto).
- **Atalhos do Início em lista com informação:** Próximas OS ("N
  agendadas para os próximos dias", abre a tela de OS em "Próximas"),
  Clientes offline ("N offline agora"), Ferramentas e OLTs (se
  instalado). "OS / Suporte" saiu: já está na barra de baixo.

### Alterado

- **Filtro "Hoje" da tela de OS:** passa a mostrar o trabalho de hoje —
  as agendadas para hoje e as de dias anteriores ainda em aberto —, a
  mesma conta de "Abertas" no Início.

### Corrigido

- **Modo sol:** as iniciais do avatar no Início sumiam (letras brancas
  sobre a faixa que fica branca); agora o avatar é um círculo cheio na cor
  da marca.

## [1.21.0] - 2026-11-04

### Adicionado

- **Início com os números do dia:** Abertas, Atrasadas e Concluídas na
  faixa laranja; sem OS para hoje, mostra a próxima agendada (dia, hora e
  cliente) com o botão Abrir; o atalho Clientes Offline mostra quantos
  estão offline agora.
- **Leitor de código na busca do Início:** o botão no campo lê o código
  de barras ou QR da etiqueta pela câmera; o valor entra na busca geral
  (serial de ONU, PPPoE e cliente).
- **Checklist de saída na OS:** sinal da ONU conferido, fotos anexadas,
  teste de velocidade e equipamentos organizados. Fica salvo no aparelho
  por OS e, ao finalizar, o que estiver marcado já entra na descrição
  (com a leitura do sinal), podendo ser editado.
- **Tirar foto direto na OS:** botão de câmera ao lado do anexo de
  arquivo. Fotos grandes são reduzidas no aparelho (lado maior 1600 px)
  antes de subir — envio rápido mesmo com sinal fraco.
- **Anexos sem sinal vão para a fila:** sem internet, o anexo fica
  guardado no aparelho e é enviado sozinho quando a conexão voltar. Etapas
  da OS (iniciar, finalizar) não entram na fila.
- **Faixa do sinal da ONU:** o RX aparece numa barra vermelha, amarela e
  verde com o selo Bom, Limite ou Crítico (mesmos limites de antes), na
  tela da ONU e no Resumo da Conexão.
- **Abas na OS:** Resumo (descrição e endereço), Conexão, Checklist
  (checklist de saída e fotos) e Histórico (cliente, contrato e etapas).
  Título, etapas, rota e o botão do rodapé ficam sempre à vista.
- **Abas na ONU:** Sinal (com "Atualizar agora"), Credenciais e
  Equipamento (detalhes, reiniciar e remover, longe do toque acidental).
- **Abas no cliente:** Conexões, Contratos e Contato (telefones e
  endereços). Como na Conexão, cada tela lembra a aba enquanto o app
  estiver aberto.
- **Lembrar meu usuário no login:** só o nome de usuário fica no
  aparelho, nunca a senha; o cursor já abre na senha.
- **Configurações:** tema Claro, Escuro ou Automático (segue o celular),
  cada um com seu ícone, e texto grande para o app inteiro.
- **Botão "carregando":** salvar, enviar, associar, consultar e confirmar
  etapa mostram uma rodinha e não aceitam segundo toque enquanto a ação
  não termina.

### Alterado

- **Cores da empresa:** mesma paleta do app do cliente — laranja do
  logotipo nos botões, nos destaques, na barra de status e na faixa do
  login e do Início, grafite nos textos. O ícone do app continua o mesmo.
- **Jeito de app nativo:** a tela nova entra deslizando pela direita;
  janelas que sobem de baixo fecham ao arrastar para baixo; botões afundam
  de leve ao tocar; sem realce do navegador, sem zoom na tela (o mapa da
  CTO continua com zoom), sem seleção de texto em botões e sem barra de
  rolagem; avisos acima da barra de baixo; abertura do app na cor da
  marca.
- **Sem botão de voltar nas telas:** volta-se pelo botão ou gesto do
  próprio celular.
- **Puxar para atualizar sem arrastar a tela:** uma bolinha com a seta
  desce por cima do conteúdo e gira enquanto atualiza; a tela fica parada.
- **Telas padronizadas:** cartões com borda fina no app inteiro, sem a
  faixa colorida à esquerda (na lista de OS ela fica só na OS atrasada, em
  vermelho); ícones Lucide na barra de baixo, nos atalhos, nos cabeçalhos
  e nos avisos; campos de 48 px com letra de 16 px; texto dos botões
  maior; troca de tela em 250 ms.
- **Nada mais abre e fecha:** aba Roteador (Wi-Fi, acesso ao roteador e
  observação), contratos do cliente e Cliente/Contrato/Histórico das
  etapas na OS ficam sempre abertos.
- **Login:** formulário como folha clara sobre a faixa laranja; logo do
  técnico num quadro branco, centralizado com o nome no espaço acima do
  formulário; campos e botão maiores.
- **Início:** faixa de borda a borda com a saudação, a data e os números
  do dia; busca por cima da faixa; Conexão e ONU saíram da grade (já estão
  na barra de baixo); "Minhas OS de hoje" sem OS como aviso, não mais com
  cara de campo de busca.
- **Conexão em abas reorganizadas:** Resumo (sinal da ONU primeiro),
  Roteador (Wi-Fi, acesso ao roteador e observação), CTO e Histórico (IP,
  MAC, última autenticação e histórico de conexão).
- **Aba Sinal da ONU mais compacta:** ONU e OLT num cartão só, lado a
  lado; o selo fica na linha do título e o valor e a barra não quebram
  linha.
- **Filtros de OS / Suporte:** "Todas / Hoje / Atrasadas / Próximas" com
  as mesmas abas das outras telas, busca igual à do Início e Etapa/Serviço
  no campo padrão.
- **Filtros da Auditoria:** período em abas (Tudo, Hoje, 7 dias, 30 dias,
  Período), tipo de ação numa lista agrupada (ONU, Conexão, Cliente, OS)
  no lugar de 11 botões, técnico no campo padrão, tudo aplicado na hora,
  com a contagem e "Limpar filtros".
- **Ferramentas:** Meu IP no cartão padrão e as ferramentas numa lista
  única com divisórias.
- **Cliente:** Conexões, Contratos e Contato no cartão padrão com textos
  maiores; atalhos OS/Financeiro não grudam mais no topo junto com as abas.
- **Contraste corrigido:** verde de OS, dourado do Financeiro, vermelho
  de Offline e o "Enviado" dos anexos escurecidos para o mínimo de leitura
  (4,5:1) sobre o branco.
- **Fontes:** Inter no lugar da Plus Jakarta Sans e IBM Plex Mono em
  serial, MAC, PPPoE e senha, servidas pelo próprio app (não dependem
  mais do Google Fonts) e com algarismos de largura fixa.

### Corrigido

- **Busca por CPF/CNPJ e contrato:** acha o cliente por um trecho do
  CPF/CNPJ, como no painel do Controllr (antes só com o documento
  completo); números buscam documento e contrato ao mesmo tempo
  (contratos desativados não aparecem; cancelados, sim). CPF/CNPJ com
  pontos, traço ou barra virava busca por nome.
- **Telas guardavam dados do item anterior:** ao buscar outro usuário
  PPPoE dentro da Conexão, Wi-Fi, acesso ao roteador, observação e CTO
  continuavam com os valores do cliente anterior (e "Salvar" gravaria
  esses valores no novo). O mesmo valia para anexos, checklist e textos
  ao trocar de OS, cliente ou chamado sem sair da tela. Agora cada um
  começa do zero.
- **Telas presas na versão anterior depois de atualizar:** o app aplica
  a versão nova na próxima troca de tela (ou ao voltar para ele), sem
  precisar sair e entrar de novo.
- **Busca da OS ficava com o nome do cliente** depois de abrir as OS pelo
  cadastro dele; agora o filtro vale só nessa visita.
- **Checklist apagado depois de finalizar a OS:** não fica marcado no
  aparelho nem reaparece se a OS for reaberta.
- **Nome do cliente repetido** no título e no conteúdo das seções da OS.
- **"Limpar filtros" duplicado** na tela de OS quando o filtro não acha
  nada.
- **Textos de ajuda das buscas cortados:** ficaram mais curtos e, se
  ainda não couberem, terminam em "…".
- **Lista de chamados** dava erro 500 sem `client_pk` (lia `user_pk`, que
  a sessão não tem mais); o app ainda não usava essa rota.
- **Limites no servidor:** listas de OS, chamados, financeiro e offline
  aceitam no máximo 100 por página e não aceitam início negativo; no
  máximo 3 anexos são processados ao mesmo tempo.

### Segurança

- **CSP sem o Google Fonts:** com as fontes servidas pelo próprio app, o
  servidor só libera fontes e estilos do próprio domínio.

## [1.20.0] - 2026-11-04

### Alterado

- **Barra de navegação sem "Sair":** ficam Início, OS, Conexão e ONU.
  Sair continua em Configurações.
- **Configurações:** o avatar da tela inicial abre uma folha com tema
  escuro, modo sol, avisos de OS, instalar app e sair, com a versão do app
  no rodapé. Substitui o menu suspenso.
- **Tela inicial mais curta:** grade de atalhos compacta e sem o rodapé de
  IPv4/IPv6, que continua em Ferramentas → Meu IP.
- **Conexão em abas:** Resumo (acesso PPPoE primeiro, sessão online e ONU), Wi-Fi,
  Roteador (acesso e observação) e Rede (CTO e rede). O card do cliente
  com o selo de status fica acima das abas. Wi-Fi e Roteador já abrem com
  os blocos expandidos.
- **Detalhe do cliente:** Conexões vem primeiro e aberta; Telefones,
  Endereços e Contratos começam recolhidos, mostrando a quantidade.
  Os atalhos do topo ficam só com OS e Financeiro: Conexão e ONU já estão
  nos botões de cada conexão, logo abaixo.
- **Detalhe da OS na ordem de campo:** endereço (com Rota) primeiro, depois
  descrição, conexão (agora com o sinal da ONU e "Lido há") e anexo;
  Cliente, Contrato e Histórico das etapas ficam recolhidos no fim.
- **Busca geral só na tela inicial:** o item "Buscar" saiu da barra de
  navegação, porque repetia o campo da tela inicial. Esse campo agora acha
  também a ONU pelo serial e a conexão pelo usuário PPPoE, além do
  cliente. Enter continua abrindo a lista completa, que não abre mais o
  teclado sozinha.

### Corrigido

- **Rolar a lista da busca da tela inicial para cima** às vezes disparava
  o "puxar para atualizar". Toque dentro de uma lista com rolagem própria
  não aciona mais a atualização da tela.
- **Voltar do Android depois de sair:** na tela de login, o botão voltar
  passava pelas telas visitadas antes de sair (cada uma voltava para o
  login), parecendo várias telas invisíveis abertas. Agora o voltar fecha
  o app. Depois de entrar, o login também sai do histórico: voltar na tela
  inicial fecha o app em vez de mostrar o login de novo.

## [1.19.3] - 2026-11-04

Inclui as versões 1.19.0, 1.19.1 e 1.19.2, que não têm release própria.

### Adicionado

- **Busca geral na barra de navegação:** novo item "Buscar", de qualquer
  tela. Busca enquanto se digita (a partir de 2 letras), como a da tela
  inicial. Consulta junto o cliente (nome, contrato ou CPF/CNPJ), a ONU
  pelo serial (bastam os primeiros caracteres) e a conexão pelo usuário
  PPPoE, e mostra os resultados em grupos. Antes da primeira busca, mostra
  os clientes abertos por último neste celular.
- **Selo de status do cliente:** online, offline, bloqueado ou sem
  conexão, no topo do detalhe do cliente e no card do cliente em Conexão.
  Bloqueado vem do contrato; online, da sessão de cada conexão.
- **Atalhos do cliente:** OS, Conexão, ONU e Financeiro fixos no topo do
  detalhe do cliente (a antiga seção "Financeiro" saiu). Com mais de uma
  conexão, Conexão e ONU descem até a lista de conexões. O atalho OS abre
  a lista já filtrada pelo cliente.
- **Hora da última leitura:** "Lido há X min" na sessão online (Conexão)
  e no resumo de cada conexão do cliente, atualizando sozinho.
- **Modo sol:** interruptor no menu do avatar. Alto contraste para tela
  no sol: fundo branco, texto preto e mais pesado, bordas visíveis e cores
  mais escuras. Vale por cima do tema claro ou escuro.

### Alterado

- **Toque de 48 px:** botões do app passam de 44 para 48 px de altura. Os
  ícones de copiar, revelar, editar e localizar mantêm o desenho, mas a
  área de toque vai a 48 px.
- **Reiniciar e remover ONU:** confirmação por deslizar, em vez de um
  segundo toque.
- **Estados vazios com próximo passo:** "Ver todas as OS" quando não há OS
  hoje, "Atualizar lista" e "Limpar filtros" nas OS, "Limpar busca" nos
  clientes offline.
- **Rolagem:** voltar de um detalhe devolve a lista na mesma altura; tela
  nova abre do topo.

### Segurança

- **Instalador sem chave embutida:** `deploy/install.sh` não traz mais a
  chave do ipify como valor padrão. Servidor já instalado mantém a chave
  que está em `/etc/hotnet-tecnico/backend.env`.

## [1.18.1] - 2026-10-28

### Corrigido

- **Puxar para atualizar:** voltou à tela inicial, ao detalhe da OS, ao
  detalhe do cliente, à tela da ONU e à auditoria. Desde a 1.18.0 a página
  não estica mais no topo, o que desligou o recurso do navegador nessas
  telas; agora todas usam o do próprio app.
- **Prévia do anexo quebrada:** a foto anexada na OS aparecia como imagem
  quebrada porque o CSP não liberava `blob:` em `img-src`.
- **Anexo recusado no Nginx:** o vhost Nginx de exemplo não definia
  `client_max_body_size`, e o padrão de 1 MB recusava (413) fotos e vídeos
  do celular antes de chegarem ao backend. Agora o limite é 32 MB, acima
  do `ANEXO_MAX_MB` (30 MB).

## [1.18.0] - 2026-10-26

### Adicionado

- **Progresso do dia na tela inicial:** barra "X de Y OS concluídas" no
  cabeçalho. Conta as OS do técnico agendadas para hoje, inclusive as já
  fechadas pelo escritório ou com o ticket fechado. Concluída = finalizada
  ou fechada; cancelada não conta. Nova rota `GET /api/os/resumo-dia`.
- **Vibração de retorno (Android):** vibração curta quando uma ação dá
  certo (salvar, copiar, confirmar etapa) e dupla quando dá erro. No
  iPhone o Safari não tem esse recurso e nada muda.
- **Ícone do iPhone** (`apple-touch-icon`) na tela inicial.

### Alterado

- **Área segura do iPhone:** a barra de navegação, a barra fixa da OS, o
  campo de envio do chat e os avisos ficam acima da linha de gestos.
- **Campos com 16 px:** tocar numa busca não amplia mais a tela no iPhone.
- **Sensação de app:** sem mancha azul ao tocar, sem a página esticar ao
  puxar no topo, e o texto do app não é mais selecionado ao segurar. Os
  dados que o técnico copia (PPPoE, IP, MAC, serial, protocolo, CPF,
  telefone, endereço, chat) continuam selecionáveis.
- **Transição de tela:** voltar entra pela esquerda, e a barra de
  navegação fica parada durante a troca de tela.
- **Abertura:** no tema escuro, o app abre sem clarão branco, e a barra de
  status acompanha o tema escolhido.

## [1.17.0] - 2026-10-26

### Alterado

- **Detalhe da OS:** a próxima etapa (Marcar como respondida, Iniciar ou
  Finalizar atendimento) fica num botão fixo no rodapé, sem rolar a tela.
  O topo mostra o título, o cliente, etiquetas de data, atraso, tarefa, OS
  e chamado, a linha de etapas (Agendada → Respondida → Iniciada →
  Finalizada) e os botões **Rota**, **Ligar** e **WhatsApp**. O card
  passou a se chamar **Histórico das etapas** e mostra só os horários e o
  **Desfazer**.
- **Lista de OS:** agrupada por dia (Ontem, Hoje, Amanhã, data, sem data),
  da mais antiga para a mais nova. A hora fica numa coluna à esquerda, que
  fica vermelha quando a OS está atrasada, e cada linha tem a rota a um
  toque. Cabem mais OS por tela. O protocolo saiu da linha, mas continua
  na busca.
- **Tela inicial:** os ícones dos atalhos usam um fundo claro na cor da
  área, no lugar dos blocos sólidos.
- **Legibilidade sob sol:** no tema claro, as cores de sucesso, erro,
  Conexão e ONU ficaram mais escuras e passam no contraste mínimo (o selo
  "Fechada" tinha 2,8:1).
- **Áreas de toque:** Ligar/WhatsApp, Desfazer, chips, botões pequenos e
  botões de copiar ficaram com 40 a 44 px.

## [1.16.0] - 2026-10-21

### Adicionado

- **Localização em tempo real no mapa da CTO:** o GPS acompanha o técnico
  assim que o bloco CTO aparece — o ponto **Você** (com o círculo de
  precisão) já surge no mapa e anda junto, sem tocar no botão de
  localizar. As distâncias da lista de CTOs também se atualizam sozinhas.
- **Botão "Minha localização" no mapa:** centraliza o mapa no técnico.

### Alterado

- Sem coordenada na CTO nem no endereço do cliente, o mapa abre na
  localização do técnico assim que o GPS responde.
- A sugestão automática da CTO mais próxima continua só no botão de
  localizar do campo, com a leitura mais precisa e a confirmação.

## [1.15.0] - 2026-10-20

### Adicionado

- **Mapa no bloco CTO:** miniatura com as mesmas imagens de satélite do
  mapa do Controllr. Mostra as CTOs com a cor do cadastro, a CTO escolhida
  em destaque, a sua localização e o endereço do cliente. Tocar numa CTO
  do mapa a escolhe no campo (gravar continua no **Salvar CTO**). Botões
  **Ampliar** e **Google Maps**.
- **Ocupação da CTO:** portas ocupadas/total ao lado do nome, na lista e
  no mapa (ex.: `3/16`).
- **Projeto da rede (KMZ):** com o arquivo no servidor
  (`/etc/hotnet-tecnico/projeto.kmz` ou `MAPA_PROJETO_PATH`), cabos e
  caixas do projeto aparecem no mapa em volta da CTO. Ver
  `deploy/DEPLOY.md`, seção 7.

### Alterado

- CSP dos vhosts de exemplo libera as imagens do mapa (`mt0`–`mt3.google.com`).

## [1.14.2] - 2026-10-06

### Alterado

- **Login mais rápido:** o app não busca mais a lista de usuários do
  Controllr ao entrar. Ela só servia para achar o `user_pk`, que não é mais
  usado ("Minhas OS" vai pelo técnico responsável da OS desde a 1.12.2); o
  campo também sai dos novos registros da auditoria.

### Corrigido

- **Anexo grande demais:** foto ou vídeo acima de 30 MB é recusado com
  aviso, em vez de ocupar a memória do servidor (ajustável com
  `ANEXO_MAX_MB` no `backend.env`).
- **Falha ao abrir anexo derrubava a sessão:** quando o Controllr recusava
  o arquivo, o app podia entender como sessão expirada e voltar para o
  login. Agora só mostra que não conseguiu carregar.

### Segurança

- Cookie de sessão marcado como `Secure`: só trafega em HTTPS
  (`SESSION_COOKIE_SECURE=0` desliga, apenas para testes por http).

## [1.14.1] - 2026-10-06

### Adicionado

- **Filtros na tela de OS:** busca por cliente, rua, bairro, serviço,
  protocolo ou técnico (sem acento, várias palavras); botões coloridos
  **Todas** (verde), **Hoje** (azul), **Atrasadas** (vermelho) e **Próximas**
  (roxo); seletores de **etapa** e de **tipo de serviço**. Mostra "N de M
  OS" e "Limpar filtros"; a escolha fica guardada enquanto o app estiver
  aberto. Tudo na lista já carregada.
- **Prévia do anexo na tela da OS:** a foto escolhida aparece na hora,
  embaixo do botão "Anexar", com "Enviando…" e depois "Enviado" (ou
  "Falhou").

### Corrigido

- **Botão de WhatsApp faltando:**
  - na próxima OS do dia (tela inicial), ao lado do "Ligar", usando o
    primeiro celular do cliente mesmo que o primeiro número seja fixo;
  - na tela da OS, cada número do cliente tem os seus botões (antes só o
    primeiro);
  - celular no formato antigo (DDD + 8 dígitos começando em 6 a 9) passa a
    ter WhatsApp, com o 9 na frente;
  - campo com mais de um número ("... / ...", "... ou ...") é separado.
- **Foto no histórico do chamado:** quando o Controllr manda a imagem sem o
  tipo certo, o servidor confere pelos primeiros bytes e mostra a foto
  (antes virava download). Imagem que o aparelho não consegue mostrar (ex.:
  HEIC do iPhone no Android) vira link para baixar, em vez de quebrada.
- **Site fora do ar depois de instalar com certificado já existente:** o
  instalador gravava a configuração do site no Nginx/Apache mas só a ativava
  no passo de emitir o certificado; quando o certificado já existia, a porta
  443 ficava sem o app. Agora o site é ativado sempre.
- **Renovação do certificado:** a porta 80 mandava tudo para HTTPS, inclusive
  a verificação do Let's Encrypt, e a renovação automática ia falhar. Agora o
  caminho `/.well-known/acme-challenge/` é atendido em HTTP.

## [1.13.1] - 2026-10-05

### Adicionado

- CPF/CNPJ, telefone e CEP com máscara, e botões **Ligar** e **WhatsApp**
  (WhatsApp só para celular) nos telefones do cliente e no contato da OS.

### Alterado

- **Visual mais limpo e fácil de ler em campo:**
  - a fonte do app vale também em campos, listas e menus (antes alguns
    caíam em Arial/Roboto);
  - cinzas de apoio mais escuros, legíveis sob sol (contraste mínimo AA);
  - cabeçalho das telas mais baixo, sobrando mais espaço para o conteúdo;
  - tela inicial: resumo do dia na saudação ("3 OS para hoje · 1
    atrasada"), avatar com as iniciais do técnico, lupa na busca e atalhos
    em 3 colunas; "Abrir OS" não quebra mais em duas linhas;
  - lista de **OS / Suporte**: etapa de cada OS (Agendada, Respondida, Em
    andamento) em vez de "Aberta" para todas, "Hoje 09:00" em vez da data
    completa, bairro junto do cliente e OS atrasada destacada em vermelho;
  - erro ao carregar uma tela com o mesmo visual em todo o app (ícone,
    mensagem e "Tentar novamente").
- Aviso de OS nova mostra o **endereço** (rua e número) em vez do bairro:
  "Instalação — Rua B, 12 · hoje 14:00". Sem rua cadastrada, o bairro.
- **Tela de login:**
  - o teclado do celular não põe mais maiúscula nem "corrige" o usuário
    (evitava login recusado por "Anderson" em vez de "anderson");
  - Enter no usuário vai para a senha; na senha, entra;
  - aviso de Caps Lock ligado (teclado físico);
  - "Entrando…" com indicador girando e campos travados enquanto espera;
  - erro em caixa com ícone, que some ao corrigir; o bloqueio por muitas
    tentativas aparece como aviso de espera;
  - campo vazio avisado no próprio campo, no lugar do balão do navegador;
  - "Acesso do técnico" abaixo da marca, logo maior, campos no mesmo
    arredondado do resto do app e botão de tema claro/escuro no canto.

### Corrigido

- **Atrasada** só aparecia em OS de dias anteriores: uma OS de hoje às 08:00
  ainda em aberto à noite ficava sem a marca. Agora é atrasada a OS que já
  passou do dia e hora agendados e ainda não foi iniciada (OS em andamento
  não conta), na tela inicial, no resumo do dia e na lista de OS.

## [1.12.2] - 2026-10-05

### Adicionado

- **Avisos de OS nova no celular** (notificação, mesmo com o app fechado).
  O servidor procura OS nova a cada minuto (`AVISOS_INTERVALO_SEGUNDOS`)
  com um usuário de consulta do Controllr e avisa o técnico responsável:
  tipo, bairro e horário, sem o nome do cliente; tocar abre a OS. Liga e
  desliga no menu do avatar (**Avisos de OS**). Várias OS novas de uma vez
  viram um aviso só. Continuam chegando depois do **Sair**; para parar, o
  interruptor. Se outro técnico entrar no mesmo celular, os avisos passam a
  ser dele. No iPhone, só com o app instalado na tela inicial. O
  `install.sh` gera as chaves e pergunta o usuário de consulta (ver
  `deploy/DEPLOY.md`, seção 6).

### Corrigido

- **Minhas OS de hoje** mostrava as OS que a pessoa **abriu** (`user_*` da
  OS), não as que ela **executa**. Agora usa o técnico responsável
  (`staff_username`), comparado com o login do app. O bloco também aparece
  sempre na tela inicial, sem depender de o login achar o número do técnico
  no Controllr.
- Mensagens informativas do backend não apareciam no `journalctl` (o
  uvicorn só mostra as próprias): agora aparecem, por exemplo "Vigia de OS
  ligado" ao iniciar e "N aviso(s) enviado(s)" quando sai aviso de OS nova.

## [1.11.0] - 2026-10-05

### Adicionado

- Auditoria registra também: criar, editar e excluir **endereço** (com o
  antes → depois de cada campo e da localização), localização do
  equipamento, criar e editar **telefone**, e cancelar e reabrir **OS** (com
  o motivo). O "como estava" e o nome do cliente são lidos no próprio
  Controllr. Novos filtros na tela: Endereços, Localização, Telefones e OS.

### Corrigido

- Excluir endereço que o Controllr recusa agora responde erro; antes
  respondia sucesso e a tela podia dizer que excluiu sem ter excluído.

### Alterado

- Busca de cliente e detalhe do cliente mais rápidos: as consultas ao
  Controllr saem em paralelo (no máximo 6 ao mesmo tempo por pedido) em vez
  de uma de cada vez.
- Telas de Conexão e de ONU divididas em partes menores (`pages/conexao/` e
  `pages/onu/`), sem mudança no que aparece na tela.

## [1.10.0] - 2026-10-05

### Adicionado

- **Minhas OS de hoje** na tela inicial: a próxima OS do técnico em destaque
  (horário, tipo de serviço, cliente e endereço) com os botões **Rota**
  (Google Maps já em modo navegação até o endereço), **Ligar** (primeiro
  telefone do cliente) e **Abrir OS**; abaixo, as demais OS do dia. OS de
  dias anteriores ainda em aberto aparecem no topo como **Atrasada**. Só
  aparece quando o login identificou o técnico no Controllr.
- Auditoria: `AUDITORIA_USUARIOS=*` (ou `todos`) libera a consulta para
  qualquer técnico logado, sem precisar listar cada usuário.
- Auditoria grava, nas alterações de Wi-Fi e de acesso ao roteador, o
  cliente e o usuário PPPoE, o tipo de criptografia antes e depois, o login
  e a porta anteriores e se a senha foi trocada (a senha em si nunca é
  gravada).
- Auditoria registra a **associação de ONU a cliente**: OLT, PON e número
  da ONU, serial, e cliente e usuário PPPoE em antes → depois (o novo vem
  da conexão conferida no Controllr). Novo filtro **Associações** na tela.

### Alterado

- Tela de **Auditoria** mais fácil de ler: ações agrupadas por dia (Hoje,
  Ontem...), ícone e cor por tipo de ação (remoção em destaque), quadro de
  **antes → depois** com o valor antigo riscado e o novo em verde, o IP
  (IPv4 ou IPv6) numa linha própria abaixo do técnico, detalhes
  (OLT, ONU, serial, cliente, PPPoE) em grade, e filtro por tipo de ação em
  botões no topo, no lugar da lista suspensa.
- Filtros da Auditoria em duas colunas: **De** acima de **Até**, e
  **Técnico** acima do botão **Filtrar**.

### Corrigido

- Associar ONU a um cliente confere se a conexão devolvida pelo Controllr é
  mesmo a escolhida e pertence ao cliente; senão recusa, em vez de gravar na
  ONU o usuário e a senha PPPoE de outra conexão.

### Segurança

- Anexo de chamado: só imagem (exceto SVG), vídeo, áudio e PDF abrem na
  tela; qualquer outro tipo (HTML, SVG, texto...) é baixado como arquivo,
  isolado e sem script. Antes, um anexo HTML aberto no app podia rodar
  código com a sessão de quem clicou.

## [1.7.2] - 2026-10-05

### Adicionado

- **Consulta da auditoria no app** (Ferramentas → Auditoria): quem
  reiniciou, removeu ou renomeou ONU e quem alterou Wi-Fi ou o acesso ao
  roteador, quando e de qual IP, com filtro por técnico, ação e período. Só
  para os usuários em `AUDITORIA_USUARIOS` (o instalador pergunta uma vez).
- **Limite de tentativas no login**: 5 senhas erradas do mesmo IP, ou 10 do
  mesmo usuário, bloqueiam por 15 minutos sem nem tentar no Controllr —
  protege as senhas dos técnicos e evita bloqueio da conta lá.
- Primeiros testes do backend (`backend/tests`, `requirements-dev.txt`).

### Alterado

- Log de auditoria dividido por mês (`logs/auditoria-AAAA-MM.jsonl`), com os
  de mais de 12 meses apagados automaticamente (`AUDITORIA_RETENCAO_MESES`).
  O arquivo antigo continua aparecendo na consulta.
- Notas das releases no GitHub montadas pelo `tools/notas_release.py` a partir
  deste CHANGELOG: título "v1.6.1 · assunto", seções com ícones, cada item numa
  linha só, comando de atualização copiável e link para comparar com a versão
  anterior. Aplicado a todas as releases.
- Auditoria mostra a ONU como ela aparece na tela: **OLT pelo nome**
  (sempre), PON e número da ONU, serial e, ao renomear, o nome anterior →
  novo. Reiniciar, remover e renomear passam a gravar esses dados; nos
  registros antigos eles vêm da mesma busca de ONU que a tela usa no
  Controllr (só vale o resultado cujo número confere), em paralelo, poucas
  de cada vez, e guardados por 10 minutos.

### Corrigido

- **IP da auditoria podia ser falsificado**: o app confiava primeiro em
  `CF-Connecting-IP` e no primeiro IP do `X-Forwarded-For`, que o navegador
  pode mandar com qualquer valor. Agora usa o `X-Real-IP` do proxy ou o
  último IP do `X-Forwarded-For` (o que o proxy acrescenta). No Apache, o
  `X-Real-IP` chegava como "(null)": o vhost passa a usar
  `expr=%{REMOTE_ADDR}`.

## [1.6.1] - 2026-10-02

### Adicionado

- Integração opcional com o Coletor de OLTs (projeto COLETA-OLT) no mesmo
  domínio, em `/olt/`: o menu **OLTs** só aparece no painel quando o coletor
  está instalado (`/olt/api/saude` responde) — sem ele, nada muda. O coletor
  aceita a sessão do técnico (cookie `TECSESSION`, validado no `/auth/me`),
  então quem está logado no PWA entra direto, sem outra senha.
- Login aceita `?voltar=/olt/...`: quem abre o coletor sem sessão entra no
  técnico e volta para onde estava (só caminhos de `/olt/`).
- Vhosts de exemplo (Nginx e Apache) incluem, se existir, o trecho que o
  coletor grava em `/etc/coletor-olt/web/` — sem o coletor, o include não
  acha nada.

### Alterado

- Service worker não responde navegações de `/olt/` com o app do técnico.

### Corrigido

- `deploy/install.sh` atualiza o próprio arquivo com `git pull` durante a
  execução; como o bash lê o script aos poucos, a versão nova podia ser
  executada pela metade. Agora o script inteiro é lido antes de começar.

## [1.5.0] - 2026-09-15

### Adicionado

- Motivo e data/hora da última queda da ONU (`onu_last_down_reason`/
  `onu_last_down_time`, campos não documentados do Controllr) exibidos
  no card de status da tela ONU.

## [1.4.0] - 2026-09-12

### Adicionado

- Detecção de sessão encerrada manualmente no painel Controllr:
  checagem periódica (`CONTROLLR_LIVENESS_CHECK_SECONDS`, 60s) via
  `/web_auth/acl_perm/list`; se a sessão não for mais aceita, desloga
  o técnico.

### Alterado

- Autenticação com o Controllr passou de Basic Auth por requisição
  para o cookie de sessão do login, em toda chamada — Basic Auth abria
  uma segunda sessão "implícita" no Controllr, sem token pra fechar,
  duplicada na lista de usuários online do painel.
  `TechnicianSession.basic_auth` removido.
- Sessão do técnico não expira mais por TTL fixo (`SESSION_TTL_SECONDS`,
  removido) — validade decidida pelo Controllr via a checagem de
  liveness. `SESSION_COOKIE_MAX_AGE_SECONDS` (24h) limita só o cookie
  no navegador.
- Botão "Tentar novamente" trocado de `botao-primario` para
  `botao-secundario` nas 8 telas com esse estado de erro.
- Ícone da ONU trocado de roteador (MdRouter) para cabo (MdCable).

### Corrigido

- Logout não encerrava a sessão no Controllr quando o `/login`
  respondia com redirect — `ControllrLogin.login` agora lê o cookie do
  `cookie_jar`, não de `response.cookies`.
- Sessões órfãs no Controllr: a falha de liveness descartava a sessão
  local sem chamar `/session/logout` antes — extraída
  `encerrar_sessao_controllr`, usada nos dois lugares.
- Pull-to-refresh na tela Conexão sem cliente/CPE selecionado quebrava
  com "Informe client_pk...". Novo `atualizarTela` cobre o caso sem
  parâmetro.
- Botões com CSS de gradiente bespoke fora do sistema `.botao`
  ("Atualizar agora" e leitor de QR na ONU, busca em Conexão, "Entendi"
  do modal iOS) convertidos pro sistema padrão; nova classe utilitária
  `.botao-quadrado`.

## [1.3.0] - 2026-09-12

### Adicionado

- Rodapé da tela inicial (Home) com IPv4/IPv6 da rede atual, consultados
  automaticamente ao entrar na tela, exibidos como chips coloridos.
- Ferramenta "SIMET (NIC.br)" (top.nic.br/connection) no menu Ferramentas.
- Ferramenta "Meu IP": consulta o IPv4 e o IPv6 (quando a rede tem os
  dois) e a localização de cada um diretamente no app (Geolocation API
  do ipify), com cidade, estado, país, CEP, fuso horário, provedor e
  rede/ASN — em vez de abrir um site externo. Requer `IPIFY_API_KEY`
  configurada no servidor; o `deploy/install.sh` já grava a chave numa
  instalação nova.

### Corrigido

- IPv4/IPv6 da ferramenta "Meu IP" não eram descobertos: a CSP
  (`connect-src`) dos exemplos de configuração do Nginx/Apache bloqueava
  a chamada do navegador para api.ipify.org/api6.ipify.org, caindo
  sempre no IP genérico único detectado pelo servidor. Adicionados os
  dois domínios ao `connect-src`; também corrigido o rótulo mostrado
  para cada resultado (IPv4/IPv6/IP genérico, conforme o caso).

### Removido

- Ferramenta "Teste de DNS" (dnsleaktest.com) do menu Ferramentas.
- Link externo "Qual é meu IP" — substituído pela consulta inline "Meu IP".
- Link "Ver localização aproximada no mapa" da ferramenta "Meu IP".

## [1.2.0] - 2026-09-12

### Adicionado

- Tela "Clientes Offline": lista clientes com contrato ativo e CPE
  habilitado sem sessão ativa no momento. Acessível pelo menu principal,
  com atalho direto para a tela de Conexão de cada cliente. Campo de
  busca filtra a lista por nome, usuário PPPoE, contrato ou CTO.

### Corrigido

- `total` das listagens do backend (`brbyteapi`) refletia o tamanho da
  página atual em vez do total real no servidor. Corrigido para usar o
  `total` retornado pelo próprio Controllr no corpo da resposta.

## [1.1.0] - 2026-09-11

### Adicionado

- Tela de Financeiro: faturas (cobranças) do cliente, com status (paga,
  em aberto, atrasada) e indicação de pagamentos em observação, além de
  ação para registrar uma nova observação numa fatura em aberto. O
  acesso é controlado pela liberação de ACL do técnico no Controllr.

### Alterado

- Tela de detalhe do cliente: "Financeiro" passa a ser uma seção própria
  (como Telefones, Endereços etc.), com o botão "Cobranças" abaixo do
  título levando à tela de faturas. O atalho "Conexão" foi removido de
  dentro do Contrato (mantido por CPE, na seção "Conexões"). As ações de
  navegação da tela (Cobranças, Conexão, ONU, Ver no Google Maps,
  Adicionar telefone, Ver contrato assinado) usam o mesmo estilo de
  botão colorido por área da tela de Conexão, em vez do chip neutro.

### Corrigido

- Observação de pagamento criada pelo app nascia desabilitada. O campo
  `obs_status` do Controllr usa `0` para habilitado (valor diferente de
  zero é desabilitado).

## [1.0.0] - 2026-09-10

Primeira versão estável, já validada em uso real pelos técnicos em produção
(`tecnico.hotnet.net.br`). Consolida todo o desenvolvimento inicial do
aplicativo.

### Adicionado

- Autenticação do técnico com sessão própria por cookie (`TECSESSION`),
  refletindo o login/logout do Controllr.
- Busca unificada de cliente (nome, CPF/CNPJ, contrato ou usuário PPPoE) com
  sugestões ao vivo.
- Detalhe do cliente com endereço, contrato (status de assinatura, itens e
  link de assinatura digital) e telefones, com atalhos para Conexão, ONU,
  Suporte e Ordem de Serviço.
- Edição de endereço do cliente com captura de localização (GPS) e link
  direto para o Google Maps.
- Tela de Conexão: dados do CPE (usuário PPPoE, IP/MAC, Circuit ID),
  criptografia Wi-Fi editável, observação, CTO/porta e acesso ao roteador.
- Sugestão de CTO por proximidade, a partir da localização do técnico.
- Status óptico da ONU: sinal, distância até a CTO, indicação de "dados
  coletados há X", edição do nome da ONU e ações de reiniciar/remover/
  associar cliente.
- Sessão online e histórico de sessão do cliente (usuário PPPoE, IP, MAC,
  Circuit ID e uso de banda).
- Fluxo de Ordem de Serviço (OS) com os 4 estágios reais (respondida,
  iniciada, finalizada) e confirmação obrigatória por item, separado dos
  chamados de Suporte.
- Tela de Suporte (chamados/chat) com visualização de fotos e vídeos
  anexados.
- Leitor de código de barras/QR nativo (Barcode Detection API), incluindo
  suporte no iPhone.
- Log de auditoria das ações sensíveis do técnico (ação, alvo e IP real).
- Menu de Ferramentas.
- Instalação como PWA, com prompt próprio de instalação no iOS.
- Identidade visual "HOTNET TECH": logotipo, ícones e sistema de botões
  unificado.

### Alterado

- Telas de Conexão e ONU consolidadas na tela do cliente, com navegação
  cruzada entre Cliente, Conexão, ONU, Suporte e OS.
- Buscas de cliente, ONU e usuário PPPoE unificadas em combobox com filtro
  parcial ao vivo.
- Layout e cores da tela de Conexão revisados para melhor leitura.
- Duração e resiliência da sessão do técnico aprimoradas (não trava mais ao
  trocar de usuário/CPE).
- Precisão da sugestão de CTO por proximidade ajustada à precisão real do
  GPS reportada pelo dispositivo.

### Corrigido

- Diversas correções de integração com a API do Controllr/BrByte (filtros
  `where`, codificação do corpo do POST, nomes de campo e colunas ambíguas)
  que causavam dados ausentes ou incorretos em cliente, endereço, CPE, ONU,
  contrato, sessão online e Ordem de Serviço — detalhamento técnico em
  `CONTROLLR_API_NOTES.md`.
- Logout passa a encerrar a sessão do Controllr corretamente, em vez de
  depender apenas do Basic Auth.
- Erro 400 em "Minhas OS" causado por `user_pk` ambíguo em
  `support_ctl/os/list`.
- IP "(null)" exibido no log de auditoria.
- Janela de amostragem do GPS que podia falhar ao obter a localização do
  técnico.
- `deploy/install.sh`: HOME inexistente do usuário de serviço e
  travamento ao atualizar com porta não padrão.

### Removido

- Envio de mensagem pelo chamado de Suporte.
- Paginação da lista de Suporte.
- Botão de busca redundante e aba "Clientes" da barra de navegação
  inferior.
- Link de Contrato na tela de ONU.

[não lançado]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.18.1...HEAD
[1.25.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.24.0...v1.25.0
[1.24.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.23.3...v1.24.0
[1.23.3]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.23.2...v1.23.3
[1.23.2]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.23.1...v1.23.2
[1.23.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.23.0...v1.23.1
[1.23.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.22.0...v1.23.0
[1.22.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.21.0...v1.22.0
[1.21.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.20.0...v1.21.0
[1.20.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.19.3...v1.20.0
[1.19.3]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.18.1...v1.19.3
[1.18.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.18.0...v1.18.1
[1.18.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.17.0...v1.18.0
[1.17.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.16.0...v1.17.0
[1.16.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.15.0...v1.16.0
[1.15.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.14.2...v1.15.0
[1.14.2]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.14.1...v1.14.2
[1.14.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.13.1...v1.14.1
[1.13.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.12.2...v1.13.1
[1.12.2]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.11.0...v1.12.2
[1.11.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.7.2...v1.10.0
[1.7.2]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.6.1...v1.7.2
[1.6.1]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.5.0...v1.6.1
[1.5.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET/releases/tag/v1.0.0
