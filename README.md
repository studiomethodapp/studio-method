<p align="center">
  <img src="src-tauri/icons/128x128.png" width="96" alt="Studio Method" />
</p>

<h1 align="center">Studio Method</h1>

<p align="center">
  Um app de desktop que organiza o fluxo de trabalho de times de produto — do PRD ao código — com ajuda de agentes de IA.
</p>

---

## O que é

O Studio Method é um aplicativo de desktop (Mac e Windows) feito para times de produto trabalharem juntos, cada um na sua etapa, dentro do mesmo projeto:

- **PM (Product Manager)** — cria e gerencia o PRD (documento de requisitos do produto).
- **PD (Product Designer)** — transforma o PRD em protótipo.
- **Dev (Desenvolvedor)** — recebe o projeto compartilhado e faz a implementação.

O app se adapta ao perfil escolhido: cada pessoa vê só as informações e ferramentas relevantes para a sua função. A comunicação entre as etapas acontece dentro do próprio app — ao marcar um projeto como "Compartilhar com o Dev", por exemplo, ele já cai pronto na fila de quem for implementar.

Todo o trabalho é feito com apoio de agentes de IA (acionados digitando `/` no chat), que ajudam a escrever o PRD, gerar o protótipo ou orientar a implementação — respeitando as diretrizes de design e o nível de aderência ao design system que o time configurar.

## Privacidade e segurança

**Os seus projetos e arquivos ficam no seu computador.** O Studio Method não envia o conteúdo dos seus projetos (PRDs, protótipos, código, arquivos) para nenhum servidor — tudo é lido e salvo diretamente na pasta que você escolher no seu próprio disco.

O único dado que passa por um servidor externo (Supabase) é o necessário para o **login da sua conta** (e-mail e senha, para você acessar o app). Nenhum conteúdo de projeto é armazenado lá.

Se você conectar um modelo de IA (Claude, um servidor Ollama local, ou outro compatível com a API da OpenAI), as mensagens que você enviar no chat são compartilhadas com esse provedor de IA para gerar as respostas — como acontece em qualquer app que usa IA. Sem conectar um modelo, os agentes não funcionam, mas o resto do app funciona normalmente.

## Como instalar

> Este repositório é privado — só quem tem acesso convidado consegue ver esta página e baixar os arquivos.

1. Vá até a aba **[Releases](../../releases)** deste repositório.
2. Baixe o instalador do seu sistema na versão mais recente:
   - **Mac**: arquivo `.dmg`
   - **Windows**: arquivo `.msi` ou `.exe`
3. Abra o instalador e siga o passo a passo.

**Aviso de segurança do sistema operacional:** como o app ainda não passou pelo processo pago de assinatura digital (Apple/Microsoft), o Mac e o Windows podem mostrar um aviso dizendo que o desenvolvedor não é reconhecido. Isso é esperado — para abrir mesmo assim:
- **Mac**: clique com o botão direito no app → "Abrir" → confirme "Abrir" na janela que aparecer.
- **Windows**: na tela azul do SmartScreen, clique em "Mais informações" → "Executar assim mesmo".

## Primeiros passos após instalar

1. Crie sua conta ou faça login.
2. Escolha seu perfil (PM, PD ou Dev).
3. Vá em **Configurações → Modelos de IA** e conecte um modelo (recomendado: sua assinatura da Claude), para os agentes poderem responder.
4. Comece um projeto novo e explore o chat digitando `/`.
