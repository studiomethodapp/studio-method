<p align="center">
  <img src="src-tauri/icons/128x128.png" width="96" alt="Studio Method" />
</p>

<h1 align="center">Studio Method</h1>

<p align="center">
  <a href="README.md">Português (BR)</a> ·
  <a href="docs/i18n/README.en.md">English</a> ·
  <a href="docs/i18n/README.zh-CN.md">中文</a>
</p>

---

O Studio Method é um aplicativo de desktop para macOS e Windows que funciona como um hub centralizador de métodos avançados de trabalho com IA, como Superpowers e BMAD.

## O que é

Ele organiza e conecta todo o fluxo de produção de times de produto, unificando desde a concepção e escrita do PRD até o código final.

Dentro da plataforma, cada integrante trabalha no mesmo projeto a partir de uma interface adaptada ao seu perfil:

- **PM (Product Manager)**: estrutura e gerencia os requisitos do produto em PRDs padronizados.
- **PD (Product Designer)**: transforma o escopo em protótipos alinhados às diretrizes do projeto.
- **Dev (Desenvolvedor)**: recebe os handoffs já estruturados e prontos para a fila de implementação.

A passagem de bastão acontece de forma contínua no próprio app. Ao sinalizar uma etapa como concluída ou pronta para o próximo perfil, o projeto avança automaticamente para a fila do responsável seguinte.

Durante todo o processo, agentes de IA integrados e acionados por comando de barra (`/`) dão suporte à execução das tarefas. Eles aplicam as metodologias configuradas para auxiliar na escrita de documentações, na geração de protótipos e no direcionamento do código, garantindo o nível ideal de aderência ao design system e às regras do time.

## Privacidade e segurança

**Os seus projetos e arquivos ficam no seu computador.** O Studio Method não envia o conteúdo dos seus projetos (PRDs, protótipos, código, arquivos) para nenhum servidor — tudo é lido e salvo diretamente na pasta que você escolher no seu próprio disco.

O único dado que passa por um servidor externo (Supabase) é o necessário para o **login da sua conta** (e-mail e senha, para você acessar o app). Nenhum conteúdo de projeto é armazenado lá.

Se você conectar um modelo de IA (Claude, um servidor Ollama local, ou outro compatível com a API da OpenAI), as mensagens que você enviar no chat são compartilhadas com esse provedor de IA para gerar as respostas — como acontece em qualquer app que usa IA. Sem conectar um modelo, os agentes não funcionam, mas o resto do app funciona normalmente.

## Como instalar

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
