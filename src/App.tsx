import { useState, useRef, useEffect } from "react";
import "./App.css";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, writeFile, mkdir, readTextFile, copyFile, remove } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Command } from "@tauri-apps/plugin-shell";
import { homeDir } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";
import { check as checkForAppUpdate } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createClient } from "@supabase/supabase-js";
import logoStudioMethod from "./assets/logo-studiomethod-negative.svg";

// Login/criar conta de verdade (Supabase) — a "publishable key" abaixo é feita pra ficar
// exposta no app (equivalente à antiga "anon key"), não é um segredo. O acesso real aos dados
// é controlado do lado do Supabase (Row Level Security), não por essa chave estar escondida.
const SUPABASE_URL = "https://llvmoezsuneijkuxjvez.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WldIzNJViwE9y7HMFL_GBA_A9Wn7gxS";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
// Página (fora do app, hospedada no GitHub Pages) onde a pessoa realmente digita a nova senha
// depois de clicar no link de "esqueci minha senha" que chega por e-mail.
const RESET_PASSWORD_URL = "https://studiomethodapp.github.io/studio-method-confirm/reset-password.html";

// Chave usada para salvar/ler a lista de projetos na memória permanente do app
const PROJECTS_STORAGE_KEY = "studio-method-projects";
// Marca se a pessoa já viu o tour de boas-vindas (onboarding), pra não mostrar de novo
const ONBOARDING_STORAGE_KEY = "studio-method-onboarding-seen";
// Chave usada para salvar/ler a pasta-mãe onde todos os projetos são organizados
const WORKSPACE_ROOT_KEY = "studio-method-workspace-root";
// Chave usada para salvar/ler o caminho do repositório Git (GitHub/GitLab) — ainda não funcional
const GIT_REPO_PATH_KEY = "studio-method-git-repo-path";
// Chave usada para salvar/ler o caminho do Design System corporativo (Figma, GitHub, GitLab, pasta local etc.)
const DESIGN_SYSTEM_PATH_KEY = "studio-method-design-system-path";
// Chave usada para salvar/ler o nível de aderência exigido ao Design System (0 a 100)
const DESIGN_SYSTEM_ADHERENCE_KEY = "studio-method-design-system-adherence";
const DESIGN_GUIDELINES_KEY = "studio-method-design-guidelines";
// Chave usada para salvar/ler o endereço do servidor Ollama local
const OLLAMA_ENDPOINT_KEY = "studio-method-ollama-endpoint";
// Chave usada para salvar/ler a chave de API da Claude (Anthropic) — ainda não conectada de fato
const CLAUDE_API_KEY_KEY = "studio-method-claude-api-key";
// Chave usada para salvar/ler o perfil escolhido pelo usuário (pm, pd ou dev)
const USER_PROFILE_KEY = "studio-method-user-profile";
// Chaves usadas para salvar/ler o provedor de IA "Outro" (endpoint compatível com a OpenAI)
const CUSTOM_PROVIDER_NAME_KEY = "studio-method-custom-provider-name";
const CUSTOM_PROVIDER_BASE_URL_KEY = "studio-method-custom-provider-base-url";
const CUSTOM_PROVIDER_MODEL_KEY = "studio-method-custom-provider-model";
const CUSTOM_PROVIDER_API_KEY_KEY = "studio-method-custom-provider-api-key";
// Chave usada pra guardar a credencial obtida ao conectar com a assinatura Claude (via "claude setup-token")
const CLAUDE_OAUTH_TOKEN_KEY = "studio-method-claude-oauth-token";
// Quando "1", o app NÃO injeta o token guardado em cada chamada: deixa o próprio "claude" usar
// (e renovar sozinho) o login dele. Isso evita reconectar toda hora: o token que o app lê do
// Chaveiro é o de login, de curta duração, e só o "claude" sabe renová-lo.
const CLAUDE_OWN_LOGIN_KEY = "studio-method-claude-own-login";
// Detecta Windows pra evitar truques específicos de macOS/Linux (como o terminal
// simulado via "script", que não existe no Windows) no fluxo de conectar a assinatura.
const IS_WINDOWS = typeof navigator !== "undefined" && /win/i.test(navigator.platform || navigator.userAgent || "");
// Guarda a versão que a pessoa já viu e decidiu adiar (clicou em "Não"), pra não ficar
// mostrando o mesmo aviso de atualização toda vez que o app abre.
const UPDATE_DISMISSED_VERSION_KEY = "studio-method-update-dismissed-version";

// Perfis disponíveis no primeiro acesso, e a paleta de cores de cada um.
// A estrutura visual do app é sempre a mesma — só a cor de destaque muda por perfil.
const PROFILES = [
  {
    id: "pm",
    label: "Product Manager",
    theme: {
      accent: "#c084fc",
      accentRgb: "192, 132, 252",
      accentStrong: "#9333ea",
      accentStrongRgb: "147, 51, 234",
      accentDeep: "#7e22ce",
      secondaryRgb: "79, 70, 229",
      muted: "#a78bfa",
      pale: "#e9d5ff",
      highlight: "#f5d0fe",
      soft: "#f0abfc",
      iconInactive: "#c4b5fd",
      bg1: "#4a1259",
      bg2: "#1a0826",
      bg3: "#0d0414",
      menuBg: "#1c0f2e"
    }
  },
  {
    id: "pd",
    label: "Product Designer",
    theme: {
      accent: "#60a5fa",
      accentRgb: "96, 165, 250",
      accentStrong: "#2563eb",
      accentStrongRgb: "37, 99, 235",
      accentDeep: "#1d4ed8",
      secondaryRgb: "56, 90, 220",
      muted: "#93c5fd",
      pale: "#dbeafe",
      highlight: "#bfdbfe",
      soft: "#93c5fd",
      iconInactive: "#93c5fd",
      bg1: "#12275c",
      bg2: "#0b1638",
      bg3: "#050a1f",
      menuBg: "#0e1a40"
    }
  },
  {
    id: "dev",
    label: "Developer",
    theme: {
      accent: "#4ade80",
      accentRgb: "74, 222, 128",
      accentStrong: "#16a34a",
      accentStrongRgb: "22, 163, 74",
      accentDeep: "#15803d",
      secondaryRgb: "34, 197, 94",
      muted: "#86efac",
      pale: "#dcfce7",
      highlight: "#bbf7d0",
      soft: "#86efac",
      iconInactive: "#86efac",
      bg1: "#0f3d24",
      bg2: "#0a2417",
      bg3: "#04120b",
      menuBg: "#0c2a1a"
    }
  }
];

// Retorna a configuração completa do perfil (com fallback pra PM caso ainda não escolhido)
const getProfileConfig = (profileId) => PROFILES.find((p) => p.id === profileId) || PROFILES[0];

// Quais perfis enxergam cada card da tela de Configurações — assim cada pessoa só vê o
// que é útil pro papel dela, em vez de tudo pra todo mundo. Pra adicionar/ajustar um card
// no futuro, basta mexer aqui, sem precisar caçar "if" espalhado pelo JSX.
const SETTINGS_CARD_VISIBILITY = {
  storage: ["pm", "pd", "dev"], // Pasta raiz / Repositório na nuvem — todo mundo precisa saber onde o projeto é salvo
  designSystem: ["pd"], // Só o PD usa a referência "crua" do Design System — o Dev trabalha em cima do PRD + protótipo do PD, que já carregam as decisões de design aplicadas
  designGuidelines: ["pd"], // Documentos de diretrizes de design (PDF/Word/Markdown) que os agentes devem consultar — só o PD gerencia isso
  aiModels: ["pm", "pd", "dev"] // Todo mundo escolhe qual motor de IA os agentes vão usar
};
const isSettingsCardVisibleForProfile = (cardKey, profileId) =>
  (SETTINGS_CARD_VISIBILITY[cardKey] || []).includes(profileId);

// Card genérico de "Assinatura de IA do trabalho": em vez de um card hardcoded pra
// Claude e outro card do zero pra cada assinatura nova (ex: uma que a empresa passe
// a oferecer no futuro), existe UM card só, com um seletor de qual assinatura
// conectar. Hoje só "claude-code" tem "available: true" (conexão real implementada,
// via Claude Code CLI); os demais entram como "em breve" — o card já está pronto pra
// eles, só falta implementar a conexão de cada um quando a hora chegar.
const SUBSCRIPTION_PROVIDERS = [
  { id: "claude-code", label: "Claude Code (assinatura Claude Pro/Max)", available: true },
  { id: "coming-soon", label: "Outra assinatura do trabalho (em breve)", available: false }
];

// Lista genérica de motores conhecidos pro passo "Adicionar motor de IA" — busca simples
// por nome, sem tratar nenhum motor como "o principal". "claude" e "ollama" têm um fluxo
// próprio (assinatura/API key e local, respectivamente); os demais caem no formulário
// genérico de "outro motor" já com nome e URL base pré-preenchidos.
const KNOWN_AI_ENGINES = [
  { id: "claude", label: "Claude", icon: "🔮", kind: "claude" },
  { id: "ollama", label: "Ollama (Local)", icon: "🦙", kind: "ollama" },
  { id: "openai", label: "OpenAI (GPT)", icon: "🟢", kind: "custom", baseUrl: "https://api.openai.com/v1" },
  { id: "gemini", label: "Google Gemini", icon: "✨", kind: "custom", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { id: "copilot", label: "GitHub Copilot", icon: "🐙", kind: "custom", baseUrl: "" },
  { id: "mistral", label: "Mistral AI", icon: "🌬️", kind: "custom", baseUrl: "https://api.mistral.ai/v1" },
  { id: "deepseek", label: "DeepSeek", icon: "🐳", kind: "custom", baseUrl: "https://api.deepseek.com" },
  { id: "groq", label: "Groq", icon: "⚡", kind: "custom", baseUrl: "https://api.groq.com/openai/v1" },
  { id: "xai", label: "xAI (Grok)", icon: "🚀", kind: "custom", baseUrl: "https://api.x.ai/v1" },
  { id: "perplexity", label: "Perplexity", icon: "🔎", kind: "custom", baseUrl: "https://api.perplexity.ai" },
  { id: "azure-openai", label: "Azure OpenAI", icon: "🔷", kind: "custom", baseUrl: "" },
  { id: "bedrock", label: "Amazon Bedrock", icon: "🟧", kind: "custom", baseUrl: "" },
  { id: "openrouter", label: "OpenRouter", icon: "🌐", kind: "custom", baseUrl: "https://openrouter.ai/api/v1" },
  { id: "lmstudio", label: "LM Studio (Local)", icon: "🖥️", kind: "custom", baseUrl: "http://localhost:1234/v1" }
];

// ---------------------------------------------------------------------------
// IDIOMA — dicionário de tradução da interface do app (menu lateral, tela de
// Configurações, modal de relato de problema, placeholders do Composer).
// As respostas dos agentes de IA continuam no idioma em que o modelo responder;
// isso aqui traduz só o "chrome" fixo do app.
// ---------------------------------------------------------------------------
const LANGUAGE_STORAGE_KEY = "studio-method-language";

const AVAILABLE_LANGUAGES = [
  { code: "pt", label: "Português (Brasil)" },
  { code: "en", label: "English" },
  { code: "zh", label: "中文 (简体)" }
];

const TRANSLATIONS = {
  pt: {
    nav_newProject: "Novo Projeto",
    nav_importPrd: "Importar PRD",
    nav_composerChat: "Chat",
    nav_explorerProjects: "Projetos",
    nav_settings: "Configurações",
    nav_reportProblem: "Relatar um problema",
    nav_logout: "Sair",
    settings_title: "Configurações",
    settings_subtitle: "Conecte suas ferramentas e defina como os agentes devem trabalhar.",
    settings_language_label: "Idioma",
    settings_language_desc: "Define o idioma da interface e das respostas dos agentes no chat.",
    settings_aiModels_title: "Modelos de IA",
    settings_aiModels_subtitle: "Conecte os modelos que os agentes vão usar pra responder no chat.",
    settings_save_pending: "Salvar alterações",
    settings_save_idle: "Tudo salvo",
    settings_save_done: "✅ Alterações salvas",
    composer_placeholder_bmad: "Digite ( / ) para chamar um agente BMad...",
    composer_placeholder_superpowers: "Digite ( / ) para chamar uma skill Superpowers...",
    report_button: "🚩 Relatar um problema",
    report_modalTitle: "Relatar um problema",
    report_categoryLabel: "Categoria",
    report_categoryPlaceholder: "Selecione uma categoria...",
    report_descriptionLabel: "O que aconteceu?",
    report_descriptionPlaceholder: "Descreva o problema com o máximo de detalhes possível...",
    report_cancel: "Cancelar",
    report_submit: "Enviar relato",
    report_submitting: "Enviando...",
    report_success: "✅ Relato salvo. Obrigado!",
    report_error: "Não foi possível salvar o relato. Tente novamente.",
    share_with_dev_button: "📋 Compartilhar com o Dev",
    shared_with_dev_badge: "✅ Na fila do Dev",
    dev_queue_title: "Fila de Projetos",
    dev_queue_subtitle: "Projetos que PM ou PD compartilharam com você, em ordem de prioridade. Use as setas para reordenar.",
    dev_queue_empty: "Nenhum projeto foi compartilhado com você ainda. Peça para o PM ou PD compartilhar um projeto com o Dev.",
    dev_queue_priority: "Prioridade",
    move_up: "Mover para cima",
    move_down: "Mover para baixo",
    projects_title: "Projetos",
    projects_subtitle: "Gerencie os workspaces locais e seus fluxos multi-agente.",
    badge_active: "Ativo",
    badge_receivedFrom: "Recebido de",
    btn_delete: "Excluir",
    btn_open: "Abrir",
    delete_modal_title: "Excluir projeto",
    delete_modal_confirm: "Tem certeza que deseja apagar",
    delete_modal_cancel: "Cancelar",
    delete_modal_delete: "Excluir",
    import_prd_title: "Importar um PRD (.smproj) recebido de outra pessoa",
    onboarding_title: "Bem-vindo ao Studio Method",
    onboarding_skip: "Pular",
    onboarding_next: "Próximo",
    onboarding_start: "Começar a usar",
    onboarding_step1_title: "Escolha seu perfil",
    onboarding_step1_body: "O Studio Method se adapta ao seu fluxo de trabalho:\nPM: cria e gerencia o PRD.\nPD: transforma o PRD em protótipo.\nDev: recebe o projeto e realiza a implementação.\n\nVocê verá apenas as informações e ferramentas essenciais para a sua função.",
    onboarding_step2_title: "Converse com os agentes",
    onboarding_step2_body: "Digite `/` no Chat para acionar um agente especialista (BMad ou Superpowers).\nVocê também pode anexar, colar ou arrastar arquivos e imagens diretamente para a conversa.",
    onboarding_step3_title: "Configure sua IA",
    onboarding_step3_body: "Vá em Configurações → Modelos de IA e conecte um modelo (recomendado: sua assinatura da Claude). Sem isso, os agentes não conseguem responder.",
    onboarding_step4_title: "Compartilhe entre perfis",
    onboarding_step4_body: "Ao marcar um projeto como \"Compartilhar com o Dev\", ele envia as informações direto para a fila do desenvolvedor, pronto para ser trabalhado.",
    update_dialog_title: "Atualização disponível",
    update_dialog_body: "Uma nova versão do Studio Method já está pronta. Quer atualizar agora?",
    update_dialog_no: "Não",
    update_dialog_yes: "Sim, atualizar",
    update_installing_title: "Atualizando...",
    update_installing_body: "Baixando e instalando a nova versão. O app vai reiniciar sozinho em instantes.",
    update_install_error: "Não deu para instalar a atualização agora. Tente de novo mais tarde.",
    settings_update_title: "Atualizações",
    settings_update_currentVersion: "Versão atual:",
    settings_update_available: "Uma nova versão está disponível.",
    settings_update_upToDate: "Você já está usando a versão mais recente.",
    settings_update_checking: "Checando...",
    settings_update_checkButton: "Verificar atualizações",
    settings_update_installButton: "Atualizar agora",
    settings_update_error: "Não deu para checar atualizações agora.",
    auth_choice_title: "Bem-vindo",
    auth_choice_subtitle: "Crie uma conta para começar ou acesse a plataforma.",
    auth_create_account: "Criar conta",
    auth_access_account: "Entrar",
    auth_back: "Voltar",
    auth_login_title: "Acessar conta",
    auth_login_email: "Email",
    auth_login_password: "Senha",
    auth_login_submit: "Iniciar Sessão",
    auth_forgotPassword_link: "Esqueci minha senha",
    auth_forgotPassword_title: "Redefinir senha",
    auth_forgotPassword_intro: "Digite o e-mail da sua conta. Vamos mandar um link pra você criar uma nova senha.",
    auth_forgotPassword_submit: "Enviar link",
    auth_forgotPassword_loading: "Enviando...",
    auth_forgotPassword_sentTitle: "Link enviado!",
    auth_forgotPassword_sentIntro: "Se existir uma conta com o e-mail",
    auth_forgotPassword_sentOutro: ", mandamos um link de redefinição pra ele. Confira sua caixa de entrada (e o spam).",
    auth_signup_title: "Criar conta",
    auth_signup_name: "Nome completo",
    auth_signup_email: "Email",
    auth_signup_password: "Crie uma senha",
    auth_signup_submit: "Criar conta e continuar",
    adherence_high: "Exige aprovação para qualquer componente fora do Design System.",
    adherence_low: "Cria novos componentes com liberdade e sem interrupções.",
    profile_select_title: "Qual é o seu perfil no time?",
    auth_confirmEmail_title: "Confirme seu e-mail",
    auth_confirmEmail_intro: "Mandamos um link de confirmação pra",
    auth_confirmEmail_outro: ". Clique nele para confirmar seu e-mail e depois volte aqui pra entrar.",
    auth_confirmEmail_button: "Já confirmei, entrar",
    auth_loading_login: "Entrando...",
    auth_loading_signup: "Criando...",
    auth_error_invalidCredentials: "E-mail ou senha incorretos.",
    auth_error_emailNotConfirmed: "Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).",
    auth_error_alreadyRegistered: "Já existe uma conta com esse e-mail. Tente entrar em vez de criar uma nova.",
    auth_error_weakPassword: "A senha precisa ter pelo menos 6 caracteres.",
    auth_error_invalidEmail: "E-mail inválido.",
    auth_error_network: "Não foi possível conectar. Verifique sua internet e tente de novo.",
    auth_error_generic: "Algo deu errado. Tente de novo.",
    settings_rootFolder_label: "Pasta raiz",
    settings_localMode_badge: "Modo local",
    settings_cloudRepo_label: "Repositório na nuvem",
    settings_projectsFolder_desc: "Diretório onde os novos projetos serão salvos por padrão.",
    settings_designSystem_label: "Design System de referência",
    settings_designSystem_desc: "Link do Figma, GitHub, GitLab ou pasta local utilizado como guia pelos agentes.",
    settings_designSystem_placeholder: "ex: link do Figma, repositório GitHub/GitLab ou pasta local",
    settings_adherence_label: "Nível de adesão",
    settings_adherence_free: "0 — Livre",
    settings_adherence_strict: "100 — Estrito",
    settings_adherence_note: "Acima de 50, o agente solicita aprovação antes de criar novos componentes.",
    settings_designGuidelines_label: "Diretrizes de Design",
    settings_designGuidelines_desc: "Documentos (PDF, Word ou Markdown) que os agentes devem consultar como guia obrigatório sempre que forem criar protótipos. Suba o que quiser e ligue/desligue cada um conforme o projeto que estiver mexendo.",
    settings_designGuidelines_shortHint: "Documentos mais curtos e assertivos funcionam melhor com os agentes.",
    settings_designGuidelines_addButton: "+ Adicionar documento",
    settings_designGuidelines_empty: "Nenhum documento adicionado ainda.",
    settings_aiEngine_searchPlaceholder: "Busque ou digite o nome do motor que você quer conectar.",
    settings_aiEngine_noneAvailable: "Nenhum motor disponível pra adicionar.",
    claude_connectButton: "🔗 Conectar com minha assinatura (Claude Pro/Max)",
    claude_connectingButton: "Conectando...",
    claude_connecting_hint: "Autorizando com sua conta — se abrir uma aba do navegador ou aparecer um link no Terminal, confirme por lá. Depois de aprovar, volte aqui.",
    claude_notFound_hint: "Não encontramos o Claude Code neste computador. Abra o Terminal e rode:",
    claude_failed_hint: "Não deu pra conectar dessa vez. Confira se você autorizou no navegador e tente de novo.",
    claude_apiKey_hint: "Cole sua chave de API da Anthropic (cobrada à parte da assinatura).",
    ollama_desc: "Roda no seu computador, gratuito e já pronto pra usar. Troque o endereço abaixo só se o Ollama estiver configurado em outra porta.",
    ollama_endpoint_label: "Endereço (endpoint)",
    ollama_error_notRunning: "Erro: Certifique-se de que o Ollama está rodando localmente.",
    customProvider_error_prefix: "Erro do modelo",
    customProvider_error_httpSuffix: "Verifique a URL base, o nome do modelo e a chave de API em Configurações.",
    customProvider_error_checkConfig: "verifique a configuração em Configurações.",
    customProvider_error_noText_prefix: "O modelo",
    customProvider_error_noText_suffix: "respondeu, mas sem um texto reconhecível. Confira se o nome do modelo em Configurações está certo pra esse provedor.",
    customProvider_error_timeout_prefix: "Erro:",
    customProvider_error_timeout_suffix: "demorou demais pra responder (mais de 30s). Confira se a URL base em Configurações está certa.",
    customProvider_error_offline_prefix: "Erro: não foi possível conectar a",
    customProvider_error_offline_suffix: "Verifique a URL e a chave em Configurações.",
    chat_empty_bmad: "Nenhuma instrução enviada neste projeto. Digite \"/\" na caixa abaixo para selecionar um agente BMad.",
    chat_empty_superpowers: "Nenhuma instrução enviada neste projeto. Digite \"/\" na caixa abaixo para selecionar uma skill Superpowers.",
    chat_sender_you: "Você",
    prd_generate_new_version: "🆕 Gerar nova versão",
    prd_updated_current: "✅ PRD atual atualizado",
    prd_new_version_saved: "✅ Nova versão do PRD salva",
    ai_models_settings_title: "Modelos configurados em Configurações",
    prd_panel_hint: "Leia o PRD aqui e peça para um agente (ex: Sally, UX) avaliar ou continuar a partir dele no chat ao lado.",
    artifact_download_title: "Baixar uma cópia deste artefato",
    history_label: "Histórico",
    new_project_modal_title: "Criar Workspace / Projeto",
    new_project_title_placeholder: "Título do Projeto",
    new_project_desc_placeholder: "Descrição rápida...",
    new_project_will_save_at: "📁 Este projeto será salvo em:",
    new_project_askFolder_hint: "📁 Vamos pedir a pasta onde o Studio Method vai organizar todos os seus projetos na primeira vez.",
    import_feedback_invalid: "⚠️ Esse arquivo não parece ser um PRD válido do Studio Method.",
    import_feedback_failed: "⚠️ Não foi possível importar esse arquivo.",
    artifact_download_notFound: "⚠️ Não foi possível encontrar o conteúdo desse artefato para baixar.",
    no_description_provided: "Sem descrição informada.",
    prd_imported_default_title: "PRD importado",
    claude_setupTimeout_message: "O comando \"claude setup-token\" demorou demais (mais de 30 segundos) e foi cancelado automaticamente. ",
    claude_setupTimeout_outputPrefix: "Saída recebida até aqui:",
    claude_setupTimeout_noOutput: "Nenhuma saída foi recebida — tente de novo, ou use a chave de API.",
    folder_picker_new_root_title: "Escolha a nova pasta-mãe dos projetos",
    claude_connectedLabel: "Conectado",
    claude_readyToUse: "e pronto pra usar.",
    tooltip_remove: "Remover",
    tooltip_changeEngine: "Trocar motor",
    tooltip_copyResponse: "Copiar resposta",
    tooltip_useAsPrd: "Usar esta resposta como o PRD do projeto",
    tooltip_attachFile: "Anexar arquivo",
    tooltip_downloadPrd: "Baixar este PRD",
    tooltip_showPassword: "Mostrar senha",
    tooltip_hidePassword: "Esconder senha",
    auth_login_password_placeholder: "Digite sua senha",
    auth_signup_name_placeholder: "Seu nome",
    auth_signup_password_placeholder: "Digite uma senha",
    settings_gitRepo_placeholder: "ex: github.com/seu-usuario/seu-repositorio",
    engine_search_placeholder: "Busque por um motor",
    customProvider_url_placeholder: "ex: https://api.openai.com/v1",
    customProvider_model_placeholder: "ex: gpt-4o",
    button_create: "Criar",
    addEngine_modal_title: "Adicionar motor de IA",
    customProvider_model_label: "Nome do modelo",
    artifacts_tab_title: "Artefatos do Projeto",
    engine_select_placeholder: "Selecione o motor",
    artifacts_current_label: "Atual",
    cli_error_invalidToken: "Sua conexão com a assinatura da Claude expirou ou ficou inválida. Vá em Configurações, desconecte e conecte de novo. Detalhe técnico: ",
    cli_error_notFound: "Não encontramos o Claude Code no seu computador. Reinstale com \"npm install -g @anthropic-ai/claude-code\" e conecte de novo em Configurações. Detalhe técnico: ",
    cli_error_generic: "Algo deu errado ao falar com a Claude. Detalhe técnico: ",
    cli_error_timeout: "A Claude demorou demais pra responder (mais de 5 minutos) e a tentativa foi cancelada. Tente de novo — se continuar acontecendo, tente pedir algo mais simples ou dividir em partes menores.",
    cli_error_crashed: "Erro: não foi possível rodar o Claude Code no seu computador. Detalhe: ",
    api_error_claude_prefix: "Erro da API da Claude: ",
    api_error_claude_checkKey: "verifique a chave de API em Configurações.",
    api_error_claude_network: "Erro: não foi possível conectar à API da Claude. Verifique sua conexão com a internet e a chave de API em Configurações."
  },
  en: {
    nav_newProject: "New Project",
    nav_importPrd: "Import PRD",
    nav_composerChat: "Chat",
    nav_explorerProjects: "Projects",
    nav_settings: "Settings",
    nav_reportProblem: "Report a problem",
    nav_logout: "Log out",
    settings_title: "Settings",
    settings_subtitle: "Connect your tools and define how the agents should work.",
    settings_language_label: "Language",
    settings_language_desc: "Sets the interface language and the language agents reply in during chat.",
    settings_aiModels_title: "AI Models",
    settings_aiModels_subtitle: "Connect the models the agents will use to reply in the chat.",
    settings_save_pending: "Save changes",
    settings_save_idle: "All saved",
    settings_save_done: "✅ Changes saved",
    composer_placeholder_bmad: "Type ( / ) to call a BMad agent...",
    composer_placeholder_superpowers: "Type ( / ) to call a Superpowers skill...",
    report_button: "🚩 Report a problem",
    report_modalTitle: "Report a problem",
    report_categoryLabel: "Category",
    report_categoryPlaceholder: "Select a category...",
    report_descriptionLabel: "What happened?",
    report_descriptionPlaceholder: "Describe the problem in as much detail as possible...",
    report_cancel: "Cancel",
    report_submit: "Send report",
    report_submitting: "Sending...",
    report_success: "✅ Report saved. Thank you!",
    report_error: "Couldn't save the report. Please try again.",
    share_with_dev_button: "📋 Share with Dev",
    shared_with_dev_badge: "✅ In Dev's queue",
    dev_queue_title: "Project Queue",
    dev_queue_subtitle: "Projects PM or PD have shared with you, in priority order. Use the arrows to reorder.",
    dev_queue_empty: "No project has been shared with you yet. Ask the PM or PD to share a project with Dev.",
    dev_queue_priority: "Priority",
    move_up: "Move up",
    move_down: "Move down",
    projects_title: "Projects",
    projects_subtitle: "Manage your local workspaces and multi-agent flows.",
    badge_active: "Active",
    badge_receivedFrom: "Received from",
    btn_delete: "Delete",
    btn_open: "Open",
    delete_modal_title: "Delete project",
    delete_modal_confirm: "Are you sure you want to delete",
    delete_modal_cancel: "Cancel",
    delete_modal_delete: "Delete",
    import_prd_title: "Import a PRD (.smproj) received from someone else",
    onboarding_title: "Welcome to Studio Method",
    onboarding_skip: "Skip",
    onboarding_next: "Next",
    onboarding_start: "Start using it",
    onboarding_step1_title: "Choose your profile",
    onboarding_step1_body: "Studio Method adapts to your workflow:\nPM: creates and manages the PRD.\nPD: turns the PRD into a prototype.\nDev: receives the project and implements it.\n\nYou'll only see the information and tools essential to your role.",
    onboarding_step2_title: "Chat with the agents",
    onboarding_step2_body: "Type `/` in Chat to trigger a specialist agent (BMad or Superpowers).\nYou can also attach, paste, or drag files and images directly into the conversation.",
    onboarding_step3_title: "Set up your AI",
    onboarding_step3_body: "Go to Settings → AI Models and connect a model (recommended: your Claude subscription). Without it, the agents can't reply.",
    onboarding_step4_title: "Share between profiles",
    onboarding_step4_body: "Marking a project as \"Share with Dev\" sends its information straight to the developer's queue, ready to be worked on.",
    update_dialog_title: "Update available",
    update_dialog_body: "A new version of Studio Method is ready. Do you want to update now?",
    update_dialog_no: "No",
    update_dialog_yes: "Yes, update",
    update_installing_title: "Updating...",
    update_installing_body: "Downloading and installing the new version. The app will restart on its own in a moment.",
    update_install_error: "Couldn't install the update right now. Try again later.",
    settings_update_title: "Updates",
    settings_update_currentVersion: "Current version:",
    settings_update_available: "A new version is available.",
    settings_update_upToDate: "You're already on the latest version.",
    settings_update_checking: "Checking...",
    settings_update_checkButton: "Check for updates",
    settings_update_installButton: "Update now",
    settings_update_error: "Couldn't check for updates right now.",
    auth_choice_title: "Welcome",
    auth_choice_subtitle: "Create an account to get started, or sign in to the platform.",
    auth_create_account: "Create account",
    auth_access_account: "Sign in",
    auth_back: "Back",
    auth_login_title: "Sign in",
    auth_login_email: "Email",
    auth_login_password: "Password",
    auth_login_submit: "Sign In",
    auth_forgotPassword_link: "Forgot my password",
    auth_forgotPassword_title: "Reset password",
    auth_forgotPassword_intro: "Enter your account's email. We'll send you a link to create a new password.",
    auth_forgotPassword_submit: "Send link",
    auth_forgotPassword_loading: "Sending...",
    auth_forgotPassword_sentTitle: "Link sent!",
    auth_forgotPassword_sentIntro: "If an account exists with the email",
    auth_forgotPassword_sentOutro: ", we sent a reset link to it. Check your inbox (and spam folder).",
    auth_signup_title: "Create account",
    auth_signup_name: "Full name",
    auth_signup_email: "Email",
    auth_signup_password: "Create a password",
    auth_signup_submit: "Create account and continue",
    adherence_high: "Requires approval for any component outside the Design System.",
    adherence_low: "Creates new components freely, with no interruptions.",
    profile_select_title: "What's your role on the team?",
    auth_confirmEmail_title: "Confirm your email",
    auth_confirmEmail_intro: "We sent a confirmation link to",
    auth_confirmEmail_outro: ". Click it to confirm your email, then come back here to sign in.",
    auth_confirmEmail_button: "I confirmed, sign in",
    auth_loading_login: "Signing in...",
    auth_loading_signup: "Creating...",
    auth_error_invalidCredentials: "Incorrect email or password.",
    auth_error_emailNotConfirmed: "Confirm your email before signing in (check your inbox).",
    auth_error_alreadyRegistered: "An account with this email already exists. Try signing in instead of creating a new one.",
    auth_error_weakPassword: "Password must be at least 6 characters.",
    auth_error_invalidEmail: "Invalid email.",
    auth_error_network: "Couldn't connect. Check your internet connection and try again.",
    auth_error_generic: "Something went wrong. Please try again.",
    settings_rootFolder_label: "Root folder",
    settings_localMode_badge: "Local mode",
    settings_cloudRepo_label: "Cloud repository",
    settings_projectsFolder_desc: "Folder where new projects will be saved by default.",
    settings_designSystem_label: "Reference Design System",
    settings_designSystem_desc: "Figma link, GitHub, GitLab, or local folder used as a guide by the agents.",
    settings_designSystem_placeholder: "e.g.: Figma link, GitHub/GitLab repo, or local folder",
    settings_adherence_label: "Adherence level",
    settings_adherence_free: "0 — Free",
    settings_adherence_strict: "100 — Strict",
    settings_adherence_note: "Above 50, the agent asks for approval before creating new components.",
    settings_designGuidelines_label: "Design Guidelines",
    settings_designGuidelines_desc: "Documents (PDF, Word or Markdown) that agents must consult as a mandatory guide whenever they create prototypes. Upload whatever you need and toggle each one on or off depending on the project you're working on.",
    settings_designGuidelines_shortHint: "Shorter, more assertive documents work better with the agents.",
    settings_designGuidelines_addButton: "+ Add document",
    settings_designGuidelines_empty: "No document added yet.",
    settings_aiEngine_searchPlaceholder: "Search or type the name of the engine you want to connect.",
    settings_aiEngine_noneAvailable: "No engine available to add.",
    claude_connectButton: "🔗 Connect with my subscription (Claude Pro/Max)",
    claude_connectingButton: "Connecting...",
    claude_connecting_hint: "Authorizing with your account — if a browser tab opens or a link appears in the Terminal, confirm there. Once approved, come back here.",
    claude_notFound_hint: "We couldn't find Claude Code on this computer. Open the Terminal and run:",
    claude_failed_hint: "Couldn't connect this time. Make sure you authorized in the browser and try again.",
    claude_apiKey_hint: "Paste your Anthropic API key (billed separately from your subscription).",
    ollama_desc: "Runs on your computer, free and ready to use. Only change the address below if Ollama is set up on a different port.",
    ollama_endpoint_label: "Address (endpoint)",
    ollama_error_notRunning: "Error: make sure Ollama is running locally.",
    customProvider_error_prefix: "Model error",
    customProvider_error_httpSuffix: "Check the base URL, model name, and API key in Settings.",
    customProvider_error_checkConfig: "check the configuration in Settings.",
    customProvider_error_noText_prefix: "The model",
    customProvider_error_noText_suffix: "replied, but with no recognizable text. Check that the model name in Settings is right for this provider.",
    customProvider_error_timeout_prefix: "Error:",
    customProvider_error_timeout_suffix: "took too long to respond (over 30s). Check that the base URL in Settings is correct.",
    customProvider_error_offline_prefix: "Error: couldn't connect to",
    customProvider_error_offline_suffix: "Check the URL and key in Settings.",
    chat_empty_bmad: "No instructions sent in this project yet. Type \"/\" in the box below to pick a BMad agent.",
    chat_empty_superpowers: "No instructions sent in this project yet. Type \"/\" in the box below to pick a Superpowers skill.",
    chat_sender_you: "You",
    prd_generate_new_version: "🆕 Generate new version",
    prd_updated_current: "✅ Current PRD updated",
    prd_new_version_saved: "✅ New PRD version saved",
    ai_models_settings_title: "Models configured in Settings",
    prd_panel_hint: "Read the PRD here and ask an agent (e.g. Sally, UX) to review or continue from it in the chat beside it.",
    artifact_download_title: "Download a copy of this artifact",
    history_label: "History",
    new_project_modal_title: "Create Workspace / Project",
    new_project_title_placeholder: "Project Title",
    new_project_desc_placeholder: "Quick description...",
    new_project_will_save_at: "📁 This project will be saved in:",
    new_project_askFolder_hint: "📁 We'll ask for the folder where Studio Method will organize all your projects the first time.",
    import_feedback_invalid: "⚠️ This file doesn't look like a valid Studio Method PRD.",
    import_feedback_failed: "⚠️ Couldn't import this file.",
    artifact_download_notFound: "⚠️ Couldn't find this artifact's content to download.",
    no_description_provided: "No description provided.",
    prd_imported_default_title: "Imported PRD",
    claude_setupTimeout_message: "The \"claude setup-token\" command took too long (over 30 seconds) and was automatically cancelled. ",
    claude_setupTimeout_outputPrefix: "Output received so far:",
    claude_setupTimeout_noOutput: "No output was received — try again, or use the API key instead.",
    folder_picker_new_root_title: "Choose the new parent folder for projects",
    claude_connectedLabel: "Connected",
    claude_readyToUse: "and ready to use.",
    tooltip_remove: "Remove",
    tooltip_changeEngine: "Change engine",
    tooltip_copyResponse: "Copy response",
    tooltip_useAsPrd: "Use this response as the project's PRD",
    tooltip_attachFile: "Attach file",
    tooltip_downloadPrd: "Download this PRD",
    tooltip_showPassword: "Show password",
    tooltip_hidePassword: "Hide password",
    auth_login_password_placeholder: "Enter your password",
    auth_signup_name_placeholder: "Your name",
    auth_signup_password_placeholder: "Create a password",
    settings_gitRepo_placeholder: "e.g. github.com/your-username/your-repo",
    engine_search_placeholder: "Search for an engine",
    customProvider_url_placeholder: "e.g. https://api.openai.com/v1",
    customProvider_model_placeholder: "e.g. gpt-4o",
    button_create: "Create",
    addEngine_modal_title: "Add AI engine",
    customProvider_model_label: "Model name",
    artifacts_tab_title: "Project Artifacts",
    engine_select_placeholder: "Select the engine",
    artifacts_current_label: "Current",
    cli_error_invalidToken: "Your connection to your Claude subscription has expired or become invalid. Go to Settings, disconnect and reconnect. Technical detail: ",
    cli_error_notFound: "We couldn't find Claude Code on your computer. Reinstall it with \"npm install -g @anthropic-ai/claude-code\" and reconnect in Settings. Technical detail: ",
    cli_error_generic: "Something went wrong talking to Claude. Technical detail: ",
    cli_error_timeout: "Claude took too long to respond (over 5 minutes) and the attempt was cancelled. Try again — if it keeps happening, try asking for something simpler or splitting it into smaller parts.",
    cli_error_crashed: "Error: couldn't run Claude Code on your computer. Detail: ",
    api_error_claude_prefix: "Claude API error: ",
    api_error_claude_checkKey: "check the API key in Settings.",
    api_error_claude_network: "Error: couldn't connect to the Claude API. Check your internet connection and the API key in Settings."
  },
  zh: {
    nav_newProject: "新建项目",
    nav_importPrd: "导入 PRD",
    nav_composerChat: "聊天",
    nav_explorerProjects: "项目",
    nav_settings: "设置",
    nav_reportProblem: "报告问题",
    nav_logout: "退出登录",
    settings_title: "设置",
    settings_subtitle: "连接你的工具，并定义智能体的工作方式。",
    settings_language_label: "语言",
    settings_language_desc: "设置界面语言，以及智能体在聊天中的回复语言。",
    settings_aiModels_title: "AI 模型",
    settings_aiModels_subtitle: "连接智能体在聊天中使用的模型。",
    settings_save_pending: "保存更改",
    settings_save_idle: "已全部保存",
    settings_save_done: "✅ 更改已保存",
    composer_placeholder_bmad: "输入（/）调用 BMad 智能体...",
    composer_placeholder_superpowers: "输入（/）调用 Superpowers 技能...",
    report_button: "🚩 报告问题",
    report_modalTitle: "报告问题",
    report_categoryLabel: "类别",
    report_categoryPlaceholder: "选择一个类别...",
    report_descriptionLabel: "发生了什么？",
    report_descriptionPlaceholder: "请尽可能详细地描述问题...",
    report_cancel: "取消",
    report_submit: "发送报告",
    report_submitting: "发送中...",
    report_success: "✅ 报告已保存，谢谢！",
    report_error: "无法保存报告，请重试。",
    share_with_dev_button: "📋 与 Dev 共享",
    shared_with_dev_badge: "✅ 已在 Dev 队列中",
    dev_queue_title: "项目队列",
    dev_queue_subtitle: "PM 或 PD 与你共享的项目，按优先级排序。使用箭头重新排序。",
    dev_queue_empty: "目前还没有人与你共享项目。请让 PM 或 PD 与 Dev 共享一个项目。",
    dev_queue_priority: "优先级",
    move_up: "上移",
    move_down: "下移",
    projects_title: "项目",
    projects_subtitle: "管理本地工作区和多智能体流程。",
    badge_active: "进行中",
    badge_receivedFrom: "接收自",
    btn_delete: "删除",
    btn_open: "打开",
    delete_modal_title: "删除项目",
    delete_modal_confirm: "确定要删除",
    delete_modal_cancel: "取消",
    delete_modal_delete: "删除",
    import_prd_title: "导入他人发来的 PRD（.smproj）",
    onboarding_title: "欢迎使用 Studio Method",
    onboarding_skip: "跳过",
    onboarding_next: "下一步",
    onboarding_start: "开始使用",
    onboarding_step1_title: "选择你的角色",
    onboarding_step1_body: "Studio Method 会根据你的工作流程进行适配：\nPM：创建并管理 PRD。\nPD：把 PRD 变成原型。\nDev：接收项目并进行开发实现。\n\n你只会看到与你角色相关的信息和工具。",
    onboarding_step2_title: "与智能体对话",
    onboarding_step2_body: "在聊天界面输入「/」即可调用专属智能体（BMad 或 Superpowers）。\n你也可以直接在对话框中附加、粘贴或拖入文件和图片。",
    onboarding_step3_title: "配置你的 AI",
    onboarding_step3_body: "前往 设置 → AI 模型，连接一个模型（推荐使用你的 Claude 订阅）。没有配置的话，智能体无法回复。",
    onboarding_step4_title: "在角色之间共享",
    onboarding_step4_body: "把项目标记为「与 Dev 共享」后，信息会直接发送到开发者的队列中，随时可以开始处理。",
    update_dialog_title: "有新版本可用",
    update_dialog_body: "Studio Method 的新版本已经准备好。要现在更新吗？",
    update_dialog_no: "暂不",
    update_dialog_yes: "是，立即更新",
    update_installing_title: "正在更新…",
    update_installing_body: "正在下载并安装新版本，应用将在片刻后自动重启。",
    update_install_error: "现在无法安装更新，请稍后重试。",
    settings_update_title: "更新",
    settings_update_currentVersion: "当前版本：",
    settings_update_available: "有新版本可用。",
    settings_update_upToDate: "你正在使用最新版本。",
    settings_update_checking: "正在检查…",
    settings_update_checkButton: "检查更新",
    settings_update_installButton: "立即更新",
    settings_update_error: "现在无法检查更新。",
    auth_choice_title: "欢迎",
    auth_choice_subtitle: "创建账户开始使用，或登录平台。",
    auth_create_account: "创建账户",
    auth_access_account: "登录",
    auth_back: "返回",
    auth_login_title: "登录账户",
    auth_login_email: "邮箱",
    auth_login_password: "密码",
    auth_login_submit: "登录",
    auth_forgotPassword_link: "忘记密码",
    auth_forgotPassword_title: "重置密码",
    auth_forgotPassword_intro: "输入您账户的邮箱，我们会发送一个链接让您创建新密码。",
    auth_forgotPassword_submit: "发送链接",
    auth_forgotPassword_loading: "发送中...",
    auth_forgotPassword_sentTitle: "链接已发送！",
    auth_forgotPassword_sentIntro: "如果存在使用邮箱",
    auth_forgotPassword_sentOutro: "的账户，我们已向该邮箱发送了重置链接。请查看您的收件箱（以及垃圾邮件文件夹）。",
    auth_signup_title: "创建账户",
    auth_signup_name: "姓名",
    auth_signup_email: "邮箱",
    auth_signup_password: "设置密码",
    auth_signup_submit: "创建账户并继续",
    adherence_high: "任何超出设计系统的组件都需要审批。",
    adherence_low: "可以自由创建新组件，不会被中断。",
    profile_select_title: "你在团队中的角色是什么？",
    auth_confirmEmail_title: "确认你的邮箱",
    auth_confirmEmail_intro: "我们已将确认链接发送至",
    auth_confirmEmail_outro: "。点击链接确认邮箱后，回到这里登录。",
    auth_confirmEmail_button: "我已确认，登录",
    auth_loading_login: "登录中...",
    auth_loading_signup: "创建中...",
    auth_error_invalidCredentials: "邮箱或密码不正确。",
    auth_error_emailNotConfirmed: "登录前请先确认邮箱（请查看收件箱）。",
    auth_error_alreadyRegistered: "该邮箱已注册。请尝试登录，而不是创建新账户。",
    auth_error_weakPassword: "密码至少需要 6 个字符。",
    auth_error_invalidEmail: "邮箱无效。",
    auth_error_network: "无法连接，请检查网络后重试。",
    auth_error_generic: "出现问题，请重试。",
    settings_rootFolder_label: "根文件夹",
    settings_localMode_badge: "本地模式",
    settings_cloudRepo_label: "云端仓库",
    settings_projectsFolder_desc: "新项目默认保存的文件夹。",
    settings_designSystem_label: "参考设计系统",
    settings_designSystem_desc: "智能体参考的 Figma 链接、GitHub、GitLab 或本地文件夹。",
    settings_designSystem_placeholder: "例如：Figma 链接、GitHub/GitLab 仓库或本地文件夹",
    settings_adherence_label: "遵循程度",
    settings_adherence_free: "0 — 自由",
    settings_adherence_strict: "100 — 严格",
    settings_adherence_note: "高于 50 时，智能体在创建新组件前会先请求批准。",
    settings_designGuidelines_label: "设计准则",
    settings_designGuidelines_desc: "智能体在创建原型时必须参考的文档（PDF、Word 或 Markdown）。上传你需要的任意文档，并根据正在处理的项目单独开关每一个。",
    settings_designGuidelines_shortHint: "更简短、更明确的文档对智能体效果更好。",
    settings_designGuidelines_addButton: "+ 添加文档",
    settings_designGuidelines_empty: "尚未添加任何文档。",
    settings_aiEngine_searchPlaceholder: "搜索或输入你要连接的引擎名称。",
    settings_aiEngine_noneAvailable: "没有可添加的引擎。",
    claude_connectButton: "🔗 使用我的订阅连接（Claude Pro/Max）",
    claude_connectingButton: "连接中...",
    claude_connecting_hint: "正在通过你的账户授权——如果打开了浏览器标签页或终端中出现了链接，请在那里确认。授权完成后回到这里。",
    claude_notFound_hint: "在此电脑上未找到 Claude Code。请打开终端并运行：",
    claude_failed_hint: "本次连接失败。请确认你已在浏览器中完成授权，然后重试。",
    claude_apiKey_hint: "粘贴你的 Anthropic API 密钥（费用与订阅分开计算）。",
    ollama_desc: "在你的电脑上运行，免费且开箱即用。仅当 Ollama 配置在其他端口时才需要修改下方地址。",
    ollama_endpoint_label: "地址（端点）",
    ollama_error_notRunning: "错误：请确认 Ollama 正在本地运行。",
    customProvider_error_prefix: "模型错误",
    customProvider_error_httpSuffix: "请检查设置中的基础 URL、模型名称和 API 密钥。",
    customProvider_error_checkConfig: "请检查设置中的配置。",
    customProvider_error_noText_prefix: "模型",
    customProvider_error_noText_suffix: "已回复，但没有可识别的文本。请检查设置中该提供商的模型名称是否正确。",
    customProvider_error_timeout_prefix: "错误：",
    customProvider_error_timeout_suffix: "响应时间过长（超过 30 秒）。请检查设置中的基础 URL 是否正确。",
    customProvider_error_offline_prefix: "错误：无法连接到",
    customProvider_error_offline_suffix: "请检查设置中的 URL 和密钥。",
    chat_empty_bmad: "此项目尚未发送任何指令。在下方输入框中输入「/」以选择一个 BMad 智能体。",
    chat_empty_superpowers: "此项目尚未发送任何指令。在下方输入框中输入「/」以选择一个 Superpowers 技能。",
    chat_sender_you: "你",
    prd_generate_new_version: "🆕 生成新版本",
    prd_updated_current: "✅ 当前 PRD 已更新",
    prd_new_version_saved: "✅ 新版本 PRD 已保存",
    ai_models_settings_title: "在设置中配置的模型",
    prd_panel_hint: "在此阅读 PRD，并在旁边的聊天中请智能体（例如 UX 设计师 Sally）评审或据此继续。",
    artifact_download_title: "下载此工件的副本",
    history_label: "历史记录",
    new_project_modal_title: "创建工作区 / 项目",
    new_project_title_placeholder: "项目标题",
    new_project_desc_placeholder: "简要描述...",
    new_project_will_save_at: "📁 此项目将保存在：",
    new_project_askFolder_hint: "📁 首次使用时，我们会询问 Studio Method 用来整理所有项目的文件夹。",
    import_feedback_invalid: "⚠️ 该文件似乎不是有效的 Studio Method PRD。",
    import_feedback_failed: "⚠️ 无法导入该文件。",
    artifact_download_notFound: "⚠️ 找不到该工件的内容以供下载。",
    no_description_provided: "未提供描述。",
    prd_imported_default_title: "已导入的 PRD",
    claude_setupTimeout_message: "\"claude setup-token\" 命令耗时过长（超过 30 秒），已自动取消。",
    claude_setupTimeout_outputPrefix: "目前收到的输出：",
    claude_setupTimeout_noOutput: "未收到任何输出 — 请重试，或改用 API 密钥。",
    folder_picker_new_root_title: "选择项目的新根文件夹",
    claude_connectedLabel: "已连接",
    claude_readyToUse: "已准备就绪。",
    tooltip_remove: "移除",
    tooltip_changeEngine: "更换引擎",
    tooltip_copyResponse: "复制回复",
    tooltip_useAsPrd: "将此回复用作项目的 PRD",
    tooltip_attachFile: "附加文件",
    tooltip_downloadPrd: "下载此 PRD",
    tooltip_showPassword: "显示密码",
    tooltip_hidePassword: "隐藏密码",
    auth_login_password_placeholder: "输入您的密码",
    auth_signup_name_placeholder: "您的姓名",
    auth_signup_password_placeholder: "创建密码",
    settings_gitRepo_placeholder: "例如：github.com/your-username/your-repo",
    engine_search_placeholder: "搜索引擎",
    customProvider_url_placeholder: "例如：https://api.openai.com/v1",
    customProvider_model_placeholder: "例如：gpt-4o",
    button_create: "创建",
    addEngine_modal_title: "添加 AI 引擎",
    customProvider_model_label: "模型名称",
    artifacts_tab_title: "项目工件",
    engine_select_placeholder: "选择引擎",
    artifacts_current_label: "当前",
    cli_error_invalidToken: "你的 Claude 订阅连接已过期或失效。请前往设置，断开并重新连接。技术细节：",
    cli_error_notFound: "在你的电脑上未找到 Claude Code。请用 \"npm install -g @anthropic-ai/claude-code\" 重新安装，并在设置中重新连接。技术细节：",
    cli_error_generic: "与 Claude 通信时出现问题。技术细节：",
    cli_error_timeout: "Claude 响应时间过长（超过 5 分钟），本次尝试已取消。请重试——如果持续出现，请尝试更简单的请求或将其拆分为更小的部分。",
    cli_error_crashed: "错误：无法在你的电脑上运行 Claude Code。详情：",
    api_error_claude_prefix: "Claude API 错误：",
    api_error_claude_checkKey: "请检查设置中的 API 密钥。",
    api_error_claude_network: "错误：无法连接到 Claude API。请检查你的网络连接以及设置中的 API 密钥。"
  }
};

// Categorias do modal de relato de problema — o "value" fica em inglês (estável,
// usado no arquivo salvo), o texto exibido é traduzido por idioma.
const REPORT_CATEGORIES = [
  { value: "bug", pt: "Bug / Erro", en: "Bug / Error", zh: "错误 / Bug" },
  { value: "performance", pt: "Lentidão / Desempenho", en: "Slowness / Performance", zh: "运行缓慢 / 性能" },
  { value: "suggestion", pt: "Sugestão de melhoria", en: "Improvement suggestion", zh: "改进建议" },
  { value: "confusing", pt: "Algo confuso ou difícil de usar", en: "Something confusing or hard to use", zh: "某些内容令人困惑或难以使用" },
  { value: "other", pt: "Outro", en: "Other", zh: "其他" }
];

// Identifica se um agente/skill é responsável por criar interfaces/design,
// para saber quando aplicar as regras do Design System corporativo
const isDesignAgent = (agent) => {
  if (!agent) return false;
  const haystack = `${agent.role || ""} ${agent.name || ""} ${agent.id || ""}`.toLowerCase();
  return /design|ux|ui|interface/.test(haystack);
};

// Retorna uma descrição curta do nível de aderência ao Design System, para exibir na UI
const getAdherenceLabel = (value, lang) => {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.pt;
  if (value >= 50) return dict.adherence_high || TRANSLATIONS.pt.adherence_high;
  return dict.adherence_low || TRANSLATIONS.pt.adherence_low;
};

// Lê os projetos salvos anteriormente (retorna lista vazia se nunca salvou nada)
const loadStoredProjects = () => {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Erro ao ler projetos salvos:", err);
    return [];
  }
};

// Transforma o título de um projeto num nome de pasta válido no sistema de arquivos
const sanitizeFolderName = (title) => {
  const cleaned = (title || "Novo Projeto")
    .replace(/^\//, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim()
    .slice(0, 60);
  return cleaned || "Novo Projeto";
};

// Descobre a data de criação de um artefato: usa o campo "createdAt" quando existe,
// ou tenta extrair do timestamp que fica no próprio nome do arquivo (artefatos antigos,
// salvos antes desse campo existir, seguem o padrão "agente-1790293812352.md")
const getArtifactDate = (art) => {
  if (art?.createdAt) {
    const fromField = new Date(art.createdAt);
    if (!isNaN(fromField.getTime())) return fromField;
  }
  const match = (art?.name || "").match(/-(\d{10,})\.md$/);
  if (match) {
    const fromName = new Date(Number(match[1]));
    if (!isNaN(fromName.getTime())) return fromName;
  }
  return null;
};

// Formata a data de um artefato no padrão dd/mm/aaaa, ou avisa quando não dá pra saber
const formatArtifactDate = (art) => {
  const date = getArtifactDate(art);
  return date ? date.toLocaleDateString("pt-BR") : "Data desconhecida";
};

// Ordena os artefatos do mais recente para o mais antigo (sem data conhecida vai por último)
const sortArtifactsByDateDesc = (artifacts) => {
  return [...(artifacts || [])].sort((a, b) => {
    const dateA = getArtifactDate(a);
    const dateB = getArtifactDate(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB - dateA;
  });
};

// Mapeamento Oficial de Agentes BMad Method (v6.12.0)
const OFFICIAL_BMAD_AGENTS = [
  {
    id: "bmad-agent-master",
    command: "/bmad-master",
    name: "BMad Master",
    role: "Universal Orchestrator",
    prompt: "Você é o BMad Master, o orquestrador universal do método BMad. Seu papel é coordenar discussões multi-agente (Party Mode), direcionar demandas para os agentes especialistas e listar as capacidades do ecossistema BMad."
  },
  {
    id: "bmad-agent-bmm-analyst",
    command: "/bmad-analyst",
    name: "Analyst (Mary)",
    role: "Business Analyst / Researcher",
    prompt: "Você é Mary, a Business Analyst e Researcher oficial do método BMad. Seu papel é conduzir pesquisas de mercado, elicitamento de requisitos, análise de negócios e briefs de projeto com alta precisão técnica."
  },
  {
    id: "bmad-agent-pm",
    command: "/bmad-pm",
    name: "Product Manager (John)",
    role: "Product Manager",
    prompt: "Você é John, o Product Manager oficial do método BMad. Seu papel é criar e validar Product Requirements Documents (PRDs), gerenciar Epics, User Stories e priorizar o backlog do produto."
  },
  {
    id: "bmad-agent-ux-designer",
    command: "/bmad-ux-designer",
    name: "UX Designer (Sally)",
    role: "UI/UX Architect",
    prompt: "Você é Sally, a UX Designer oficial do método BMad. Seu papel é desenhar fluxos de usuário, especificar interfaces (UI/UX) e garantir a usabilidade e experiência do produto."
  },
  {
    id: "bmad-agent-architect",
    command: "/bmad-architect",
    name: "Architect (Winston)",
    role: "System Architect",
    prompt: "Você é Winston, o System Architect oficial do método BMad. Seu papel é construir a espinha dorsal da arquitetura de software, definir a stack técnica, padrões de projeto e documentação técnica."
  },
  {
    id: "bmad-agent-dev",
    command: "/bmad-dev",
    name: "Developer (Amelia)",
    role: "Lead Developer",
    prompt: "Você é Amelia, a Lead Developer oficial do método BMad. Seu papel é coordenar e executar a implementação de código, revisão de PRs, planos de sprint e testes de desenvolvimento."
  },
  {
    id: "bmad-agent-sm",
    command: "/bmad-sm",
    name: "Scrum Master (Bob)",
    role: "Scrum Master / Agile Coach",
    prompt: "Você é Bob, o Scrum Master oficial do método BMad. Seu papel é gerenciar a geração de histórias de sprint, facilitação de rituais ágeis e orquestração de workflows."
  },
  {
    id: "bmad-agent-qa",
    command: "/bmad-qa",
    name: "QA Engineer (Quinn)",
    role: "QA Architect",
    prompt: "Você é Quinn, o QA Engineer & Architect oficial do método BMad. Seu papel é planejar estratégias de teste, garantir a qualidade da entrega, validações de requisitos e automação de testes."
  },
  {
    id: "bmad-agent-tech-writer",
    command: "/bmad-tech-writer",
    name: "Technical Writer (Paige)",
    role: "Technical Documentation Specialist",
    prompt: "Você é Paige, a Technical Writer oficial do método BMad. Seu papel é produzir, organizar e manter toda a documentação técnica, manuais de API e guias do sistema."
  }
];

// Mapeamento Oficial de Skills do Superpowers (fonte: github.com/obra/superpowers)
// No Superpowers real essas skills disparam automaticamente pelo contexto, sem comando manual.
// Aqui adaptamos como comandos / para manter a mesma familiaridade de uso do BMad dentro do app.
const OFFICIAL_SUPERPOWERS_SKILLS = [
  {
    id: "superpowers-using-superpowers",
    command: "/using-superpowers",
    name: "Using Superpowers",
    role: "Meta / Introdução",
    prompt: "Você está operando com a skill 'using-superpowers' do framework Superpowers. Seu papel é apresentar o sistema de skills ao usuário, explicando como o fluxo de trabalho funciona e orientando qual skill usar para cada situação."
  },
  {
    id: "superpowers-brainstorming",
    command: "/brainstorming",
    name: "Brainstorming",
    role: "Colaboração / Refinamento de Design",
    prompt: "Você está operando com a skill 'brainstorming' do Superpowers. Conduza um refinamento de design socrático: faça perguntas para explorar o problema, desafie suposições e ajude o usuário a chegar numa solução bem pensada antes de qualquer implementação."
  },
  {
    id: "superpowers-writing-plans",
    command: "/writing-plans",
    name: "Writing Plans",
    role: "Colaboração / Planejamento",
    prompt: "Você está operando com a skill 'writing-plans' do Superpowers. Seu papel é escrever um plano de implementação detalhado, dividido em etapas claras e verificáveis, antes de qualquer código ser escrito."
  },
  {
    id: "superpowers-executing-plans",
    command: "/executing-plans",
    name: "Executing Plans",
    role: "Colaboração / Execução",
    prompt: "Você está operando com a skill 'executing-plans' do Superpowers. Execute o plano combinado passo a passo, de forma inline, e reserve uma revisão final única ao término de toda a execução."
  },
  {
    id: "superpowers-dispatching-parallel-agents",
    command: "/dispatching-parallel-agents",
    name: "Dispatching Parallel Agents",
    role: "Colaboração / Subagentes",
    prompt: "Você está operando com a skill 'dispatching-parallel-agents' do Superpowers. Organize o trabalho em subagentes concorrentes, dividindo tarefas independentes que podem ser executadas em paralelo."
  },
  {
    id: "superpowers-subagent-driven-development",
    command: "/subagent-driven-development",
    name: "Subagent-Driven Development",
    role: "Colaboração / Desenvolvimento",
    prompt: "Você está operando com a skill 'subagent-driven-development' do Superpowers. Conduza iteração rápida com revisão em dois estágios, delegando implementação a subagentes e revisando os resultados antes de prosseguir."
  },
  {
    id: "superpowers-using-git-worktrees",
    command: "/using-git-worktrees",
    name: "Using Git Worktrees",
    role: "Colaboração / Versionamento",
    prompt: "Você está operando com a skill 'using-git-worktrees' do Superpowers. Oriente o uso de branches paralelos isolados via git worktrees, para permitir trabalho simultâneo em diferentes frentes sem conflito."
  },
  {
    id: "superpowers-finishing-a-development-branch",
    command: "/finishing-a-development-branch",
    name: "Finishing a Development Branch",
    role: "Colaboração / Versionamento",
    prompt: "Você está operando com a skill 'finishing-a-development-branch' do Superpowers. Conduza o encerramento de uma branch de desenvolvimento: revisão final, merge ou abertura de pull request."
  },
  {
    id: "superpowers-requesting-code-review",
    command: "/requesting-code-review",
    name: "Requesting Code Review",
    role: "Colaboração / Revisão",
    prompt: "Você está operando com a skill 'requesting-code-review' do Superpowers. Prepare um checklist pré-revisão de código, organizando o que precisa ser validado antes de solicitar a revisão de outra pessoa."
  },
  {
    id: "superpowers-receiving-code-review",
    command: "/receiving-code-review",
    name: "Receiving Code Review",
    role: "Colaboração / Revisão",
    prompt: "Você está operando com a skill 'receiving-code-review' do Superpowers. Ajude o usuário a responder de forma construtiva ao feedback recebido numa revisão de código, priorizando os pontos levantados."
  },
  {
    id: "superpowers-test-driven-development",
    command: "/test-driven-development",
    name: "Test-Driven Development",
    role: "Testing",
    prompt: "Você está operando com a skill 'test-driven-development' do Superpowers. Conduza o ciclo RED-GREEN-REFACTOR: primeiro escreva um teste que falha, depois o código mínimo para passá-lo, e então refatore, evitando os anti-padrões comuns de TDD."
  },
  {
    id: "superpowers-systematic-debugging",
    command: "/systematic-debugging",
    name: "Systematic Debugging",
    role: "Debugging",
    prompt: "Você está operando com a skill 'systematic-debugging' do Superpowers. Conduza um processo de rastreamento de causa raiz em 4 fases: reproduzir o problema, isolar a causa, corrigir e verificar, sem pular etapas."
  },
  {
    id: "superpowers-verification-before-completion",
    command: "/verification-before-completion",
    name: "Verification Before Completion",
    role: "Debugging",
    prompt: "Você está operando com a skill 'verification-before-completion' do Superpowers. Antes de considerar qualquer correção concluída, valide explicitamente que ela resolve o problema original, sem assumir que funcionou."
  },
  {
    id: "superpowers-diagnosing-superpowers",
    command: "/diagnosing-superpowers",
    name: "Diagnosing Superpowers",
    role: "Debugging",
    prompt: "Você está operando com a skill 'diagnosing-superpowers' do Superpowers. Ajude a diagnosticar problemas na própria sessão de trabalho ou no fluxo do framework Superpowers."
  },
  {
    id: "superpowers-writing-skills",
    command: "/writing-skills",
    name: "Writing Skills",
    role: "Meta / Criação",
    prompt: "Você está operando com a skill 'writing-skills' do Superpowers. Ajude o usuário a criar uma nova skill dentro do framework, seguindo o mesmo padrão de estrutura e clareza das skills oficiais."
  }
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  // Tela pré-login: "choice" (Criar conta / Já tenho conta), "login", "signup" ou
  // "confirmEmail" (depois de criar a conta, esperando a pessoa confirmar o e-mail)
  const [authScreen, setAuthScreen] = useState("choice");
  const [signupNameInput, setSignupNameInput] = useState("");
  const [signupEmailInput, setSignupEmailInput] = useState("");
  const [signupPasswordInput, setSignupPasswordInput] = useState("");
  // Mensagem de erro mostrada nas telas de login/criar conta (ex: senha errada, e-mail já
  // cadastrado) e se tem uma chamada em andamento (pra desabilitar o botão e evitar duplo clique)
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  // Verifica, ao abrir o app, se já existe uma sessão salva (conta real, via Supabase) — assim
  // a pessoa não precisa fazer login de novo toda vez que abre o Studio Method.
  const [checkingSession, setCheckingSession] = useState(true);
  // Controla se os campos de senha mostram o texto puro ou os pontinhos (ícone de olho).
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  // Tela "esqueci minha senha": e-mail digitado, se está enviando, erro e se já enviou
  // (pra mostrar a mensagem de sucesso em vez do formulário de novo).
  const [forgotEmailInput, setForgotEmailInput] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Perfil escolhido no primeiro acesso (pm, pd ou dev) — define a cor de toda a interface
  const [userProfile, setUserProfile] = useState(() => {
    try {
      return localStorage.getItem(USER_PROFILE_KEY) || null;
    } catch (err) {
      return null;
    }
  });
  const [profileSelectionDraft, setProfileSelectionDraft] = useState("pm"); // opção marcada na tela de escolha de perfil

  // Idioma da interface — escolhido em Configurações, vale para os três perfis
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY) || "pt";
    } catch (err) {
      return "pt";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (err) {
      console.error("Erro ao salvar o idioma:", err);
    }
  }, [language]);

  // Atualizações automáticas do app — checa sozinho ao abrir, e também dá pra checar na mão
  // pelo botão em Configurações.
  const [appVersion, setAppVersion] = useState("");
  // Objeto "Update" devolvido pelo plugin quando existe uma versão nova (guarda a versão,
  // as notas e o método pra baixar/instalar). Fica null enquanto não há nada novo.
  const [updateInfo, setUpdateInfo] = useState(null);
  // "idle" | "checking" | "upToDate" | "available" | "error"
  const [updateCheckStatus, setUpdateCheckStatus] = useState("idle");
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  // "idle" | "downloading" | "installing" | "error" — status de quando a pessoa já mandou instalar.
  const [updateInstallStatus, setUpdateInstallStatus] = useState("idle");
  const [updateInstallError, setUpdateInstallError] = useState("");

  // Confere se existe uma versão nova publicada no GitHub. `notifyIfAvailable` controla se,
  // encontrando uma, mostra o aviso na tela na hora (usado na checagem automática ao abrir o
  // app) ou só atualiza o status silenciosamente (usado quando a pessoa clica em "Verificar
  // atualizações" nas Configurações, onde o resultado já aparece ali mesmo).
  const handleCheckForUpdates = async (notifyIfAvailable) => {
    setUpdateCheckStatus("checking");
    try {
      const update = await checkForAppUpdate();
      if (update && update.available) {
        setUpdateInfo(update);
        setUpdateCheckStatus("available");
        if (notifyIfAvailable) {
          let dismissedVersion = "";
          try {
            dismissedVersion = localStorage.getItem(UPDATE_DISMISSED_VERSION_KEY) || "";
          } catch (err) {
            dismissedVersion = "";
          }
          // Só mostra o pop-up de novo se for uma versão diferente da que a pessoa já
          // adiou antes — senão ela apareceria toda vez que o app abrisse.
          if (dismissedVersion !== update.version) {
            setIsUpdateDialogOpen(true);
          }
        }
      } else {
        setUpdateInfo(null);
        setUpdateCheckStatus("upToDate");
      }
    } catch (err) {
      console.error("Erro ao checar atualização do Studio Method:", err);
      setUpdateCheckStatus("error");
    }
  };

  // Botão "Não" do aviso — só adia. A atualização continua disponível em Configurações pra
  // instalar quando a pessoa achar melhor.
  const handleDismissUpdateDialog = () => {
    setIsUpdateDialogOpen(false);
    try {
      if (updateInfo && updateInfo.version) {
        localStorage.setItem(UPDATE_DISMISSED_VERSION_KEY, updateInfo.version);
      }
    } catch (err) {
      console.error("Erro ao guardar a atualização adiada:", err);
    }
  };

  // Botão "Sim" do aviso (ou "Atualizar agora" em Configurações) — baixa, instala e reabre
  // o app já na versão nova. Projetos, login e configurações continuam do jeito que estavam,
  // porque ficam salvos em disco/localStorage, não perdidos ao reiniciar.
  const handleInstallUpdate = async () => {
    if (!updateInfo) return;
    setUpdateInstallStatus("downloading");
    setUpdateInstallError("");
    try {
      await updateInfo.downloadAndInstall();
      setUpdateInstallStatus("installing");
      await relaunch();
    } catch (err) {
      console.error("Erro ao instalar a atualização do Studio Method:", err);
      setUpdateInstallStatus("error");
      setUpdateInstallError(String(err && err.message ? err.message : err));
    }
  };

  // Ao abrir o app: guarda a versão atual (pra mostrar em Configurações) e, depois de um
  // pequeno intervalo (pra não competir com tudo mais que carrega no início), checa sozinho
  // se existe uma versão nova.
  useEffect(() => {
    let isMounted = true;
    getVersion()
      .then((v) => {
        if (isMounted) setAppVersion(v);
      })
      .catch((err) => console.error("Erro ao ler a versão do app:", err));
    const timer = setTimeout(() => {
      handleCheckForUpdates(true);
    }, 3000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // Sessão de login real (Supabase): ao abrir o app, verifica se a pessoa já estava logada
  // (sessão salva) — se sim, entra direto sem pedir login de novo. Também fica de olho em
  // mudanças de sessão (ex: token expirou, foi deslogado em outro lugar).
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const session = data?.session || null;
      if (session) {
        setIsAuthenticated(true);
        // O perfil (pm/pd/dev) fica salvo nos metadados da própria conta — assim ele
        // acompanha a pessoa mesmo se ela usar o Studio Method em outro computador.
        const savedProfile = session.user?.user_metadata?.profile || null;
        if (savedProfile) setUserProfile(savedProfile);
      }
      setCheckingSession(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session) {
        setIsAuthenticated(true);
        const savedProfile = session.user?.user_metadata?.profile || null;
        if (savedProfile) setUserProfile(savedProfile);
      } else {
        setIsAuthenticated(false);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);
  // Função de tradução: busca a chave no idioma atual, cai pro português se faltar,
  // e por último mostra a própria chave (nunca quebra a tela por falta de tradução)
  const t = (key) => (TRANSLATIONS[language] && TRANSLATIONS[language][key]) || TRANSLATIONS.pt[key] || key;

  // Modal "Relatar um problema"
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState(""); // "" | "success" | "error"

  const [currentView, setCurrentView] = useState("editor");
  const [activeTab, setActiveTab] = useState("chat");

  const [projects, setProjects] = useState(loadStoredProjects);
  const [activeProjectId, setActiveProjectId] = useState(() => {
    const stored = loadStoredProjects();
    return stored.length > 0 ? stored[0].id : null;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  // Pasta-mãe única onde todos os projetos são organizados (definida uma vez em Configurações)
  const [workspaceRoot, setWorkspaceRoot] = useState(() => {
    try {
      return localStorage.getItem(WORKSPACE_ROOT_KEY) || "";
    } catch (err) {
      return "";
    }
  });
  // Caminho do repositório Git (GitHub/GitLab) — campo preparado nas Configurações, ainda não funcional
  const [gitRepoPath, setGitRepoPath] = useState(() => {
    try {
      return localStorage.getItem(GIT_REPO_PATH_KEY) || "";
    } catch (err) {
      return "";
    }
  });

  // Caminho do Design System corporativo (Figma, GitHub, GitLab ou pasta local)
  const [designSystemPath, setDesignSystemPath] = useState(() => {
    try {
      return localStorage.getItem(DESIGN_SYSTEM_PATH_KEY) || "";
    } catch (err) {
      return "";
    }
  });
  // Nível de aderência exigido ao Design System (0 = liberdade total, 100 = seguir à risca)
  const [designSystemAdherence, setDesignSystemAdherence] = useState(() => {
    try {
      const stored = localStorage.getItem(DESIGN_SYSTEM_ADHERENCE_KEY);
      return stored !== null ? Number(stored) : 70;
    } catch (err) {
      return 70;
    }
  });

  // Documentos de diretrizes de design (PDF/Word/Markdown) que os agentes devem
  // consultar como guia obrigatório ao criar protótipos. Uma lista única — o
  // usuário sobe o que quiser e liga/desliga cada documento conforme o projeto
  // que estiver mexendo, sem separação forçada entre "globais" e "do projeto".
  const [designGuidelines, setDesignGuidelines] = useState(() => {
    try {
      const stored = localStorage.getItem(DESIGN_GUIDELINES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      return [];
    }
  });

  // Endereço do servidor Ollama local
  const [ollamaEndpoint, setOllamaEndpoint] = useState(() => {
    try {
      return localStorage.getItem(OLLAMA_ENDPOINT_KEY) || "http://localhost:11434";
    } catch (err) {
      return "http://localhost:11434";
    }
  });
  // Chave de API da Claude (Anthropic) — guardada, mas ainda não conectada de fato
  const [claudeApiKey, setClaudeApiKey] = useState(() => {
    try {
      return localStorage.getItem(CLAUDE_API_KEY_KEY) || "";
    } catch (err) {
      return "";
    }
  });

  // Rascunho dos campos de Configurações: só é aplicado/salvo de fato quando o
  // usuário clica em "Salvar alterações", em vez de gravar a cada tecla digitada
  const [draftDesignSystemPath, setDraftDesignSystemPath] = useState(designSystemPath);
  const [draftDesignSystemAdherence, setDraftDesignSystemAdherence] = useState(designSystemAdherence);
  const [draftOllamaEndpoint, setDraftOllamaEndpoint] = useState(ollamaEndpoint);
  // Qual assinatura de trabalho a pessoa quer conectar no card genérico de "Assinatura".
  // Hoje só "claude-code" tem conexão de verdade implementada; as outras entradas de
  // SUBSCRIPTION_PROVIDERS existem só pra deixar claro que o card foi pensado pra
  // funcionar com qualquer assinatura, não só a da Claude — plugar uma nova assinatura
  // no futuro é adicionar um provider aqui, não criar um card novo do zero.
  const [subscriptionProviderChoice, setSubscriptionProviderChoice] = useState("claude-code");
  // Card "Motores de IA": em vez de vários cards sempre abertos, é um card só que mostra
  // um chip por motor já adicionado, mais um botão "+ Adicionar motor de IA" que abre um
  // passo a passo curto pra conectar um motor novo.
  const [isAddEngineModalOpen, setIsAddEngineModalOpen] = useState(false);
  // O modal é uma continuação só, não telas separadas: um combobox no topo (fechado
  // mostrando "Selecione o motor", clica e abre a busca + lista, escolhe e ele fecha
  // de volta mostrando o motor escolhido com um X pra trocar) e, embaixo dele, na mesma
  // tela, o formulário daquele motor específico aparece.
  const [isEngineDropdownOpen, setIsEngineDropdownOpen] = useState(false);
  const [addEngineSelection, setAddEngineSelection] = useState(null); // { id, label, icon, kind, baseUrl } | null
  const [claudeAddMethod, setClaudeAddMethod] = useState(null); // null | "subscription" | "apikey"
  const [addEngineSearch, setAddEngineSearch] = useState("");
  // Ollama vem adicionado por padrão (é local e não precisa de configuração), mas também
  // pode ser removido como qualquer outro motor — e volta a aparecer como opção no passo
  // de "Adicionar motor de IA" se a pessoa remover e quiser reconectar depois.
  const [isOllamaEngineAdded, setIsOllamaEngineAdded] = useState(true);
  const [draftClaudeApiKey, setDraftClaudeApiKey] = useState(claudeApiKey);
  const [draftGitRepoPath, setDraftGitRepoPath] = useState(gitRepoPath);
  const [settingsSavedFeedback, setSettingsSavedFeedback] = useState(false);
  // Aba ativa do card "Pasta raiz / Repositório na nuvem" (as duas são a mesma ideia — onde os
  // projetos ficam guardados — então dividimos em abas em vez de empilhar os dois)
  const [storageSettingsTab, setStorageSettingsTab] = useState("pasta");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  // Tour de boas-vindas (onboarding): aparece só na primeira vez que a pessoa
  // escolhe um perfil, explicando de forma simples o que é PM/PD/Dev, como
  // conversar com os agentes e como conectar a IA.
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const [selectedMethod, setSelectedMethod] = useState(() => {
    const stored = loadStoredProjects();
    return stored.length > 0 ? stored[0].method || "BMAD" : "BMAD";
  });
  const [selectedEngine, setSelectedEngine] = useState(() => {
    const stored = loadStoredProjects();
    return stored.length > 0 ? stored[0].engine || "Ollama (Local)" : "Ollama (Local)";
  });

  // Provedor de IA "Outro" — um endpoint compatível com o padrão da OpenAI (o mesmo
  // formato que LM Studio, OpenRouter, Gemini via proxy e a própria OpenAI usam),
  // pra quem quiser conectar um modelo que não seja Ollama nem Claude.
  const [customProviderName, setCustomProviderName] = useState(() => {
    try {
      return localStorage.getItem(CUSTOM_PROVIDER_NAME_KEY) || "";
    } catch (err) {
      return "";
    }
  });
  const [customProviderBaseUrl, setCustomProviderBaseUrl] = useState(() => {
    try {
      return localStorage.getItem(CUSTOM_PROVIDER_BASE_URL_KEY) || "";
    } catch (err) {
      return "";
    }
  });
  const [customProviderModel, setCustomProviderModel] = useState(() => {
    try {
      return localStorage.getItem(CUSTOM_PROVIDER_MODEL_KEY) || "";
    } catch (err) {
      return "";
    }
  });
  const [customProviderApiKey, setCustomProviderApiKey] = useState(() => {
    try {
      return localStorage.getItem(CUSTOM_PROVIDER_API_KEY_KEY) || "";
    } catch (err) {
      return "";
    }
  });

  const [draftCustomProviderName, setDraftCustomProviderName] = useState(customProviderName);
  const [draftCustomProviderBaseUrl, setDraftCustomProviderBaseUrl] = useState(customProviderBaseUrl);
  const [draftCustomProviderModel, setDraftCustomProviderModel] = useState(customProviderModel);
  const [draftCustomProviderApiKey, setDraftCustomProviderApiKey] = useState(customProviderApiKey);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PROVIDER_NAME_KEY, customProviderName || "");
    } catch (err) {
      console.error("Erro ao salvar nome do provedor personalizado:", err);
    }
  }, [customProviderName]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PROVIDER_BASE_URL_KEY, customProviderBaseUrl || "");
    } catch (err) {
      console.error("Erro ao salvar URL do provedor personalizado:", err);
    }
  }, [customProviderBaseUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PROVIDER_MODEL_KEY, customProviderModel || "");
    } catch (err) {
      console.error("Erro ao salvar modelo do provedor personalizado:", err);
    }
  }, [customProviderModel]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PROVIDER_API_KEY_KEY, customProviderApiKey || "");
    } catch (err) {
      console.error("Erro ao salvar chave do provedor personalizado:", err);
    }
  }, [customProviderApiKey]);

  // Claude via assinatura — status do fluxo de conexão:
  // "unchecked" | "checking" | "not_found" (Claude Code não instalado) | "not_connected"
  // (instalado, mas o usuário ainda não clicou em Conectar) | "connecting" (autorizando no
  // navegador) | "connected" (já tem a credencial guardada, pronto pra usar a assinatura)
  const [claudeCliStatus, setClaudeCliStatus] = useState("unchecked");
  const [claudeCliVersionInfo, setClaudeCliVersionInfo] = useState("");
  // Saída real (stdout/stderr) do último "claude --version" ou "claude setup-token" que não
  // deu em conexão — mostrada na tela quando não conecta, pra dar pra ver o que aconteceu de
  // verdade (ex: um link de autorização que precise ser aberto manualmente) em vez de só um
  // status genérico de "não conectou".
  const [claudeCliDebugMessage, setClaudeCliDebugMessage] = useState("");
  // Marca se o "claude setup-token" está rodando no momento, pra dar pra matar de verdade
  // se a pessoa clicar em Cancelar (antes o Cancelar só escondia a tela e o comando
  // continuava rodando escondido, o que deixava a próxima tentativa bagunçada).
  const claudeSetupActiveRef = useRef(false);

  // Credencial obtida via "claude setup-token" — guardada aqui e usada (como variável de
  // ambiente CLAUDE_CODE_OAUTH_TOKEN) em cada chamada, sem depender do login "global" do
  // terminal do usuário.
  const [claudeOAuthToken, setClaudeOAuthToken] = useState(() => {
    try {
      return localStorage.getItem(CLAUDE_OAUTH_TOKEN_KEY) || "";
    } catch (err) {
      return "";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CLAUDE_OAUTH_TOKEN_KEY, claudeOAuthToken || "");
    } catch (err) {
      console.error("Erro ao salvar a credencial da Claude:", err);
    }
  }, [claudeOAuthToken]);

  // Se o "claude" deve usar o próprio login (em vez do token guardado). Ver CLAUDE_OWN_LOGIN_KEY.
  const [claudeUseOwnLogin, setClaudeUseOwnLogin] = useState(() => {
    try {
      return localStorage.getItem(CLAUDE_OWN_LOGIN_KEY) === "1";
    } catch (err) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CLAUDE_OWN_LOGIN_KEY, claudeUseOwnLogin ? "1" : "0");
    } catch (err) {
      console.error("Erro ao salvar a preferência de login da Claude:", err);
    }
  }, [claudeUseOwnLogin]);

  // Só confere se o Claude Code está instalado (não exige estar conectado ainda) — usado
  // pra saber se mostra "Conectar" ou as instruções de instalação.
  const handleCheckClaudeCliInstalled = async () => {
    setClaudeCliStatus("checking");
    try {
      const result = await Command.create("claude-version", ["--version"]).execute();
      if (result.code === 0 && (result.stdout || "").trim()) {
        setClaudeCliVersionInfo(result.stdout.trim());
        setClaudeCliStatus("not_connected");
      } else {
        setClaudeCliVersionInfo("");
        setClaudeCliStatus("not_found");
      }
    } catch (err) {
      console.error("Erro ao verificar o Claude Code:", err);
      setClaudeCliVersionInfo("");
      setClaudeCliStatus("not_found");
    }
  };

  // Botão "Conectar ao seu Claude" — roda "claude setup-token" dentro de um terminal virtual
  // (pty) real, que abre o navegador pra pessoa autorizar com a conta dela, e devolve uma
  // credencial que a gente guarda. Antes disso rodava como um processo comum (sem terminal de
  // verdade por trás), e o Node.js "empacava" a saída num buffer que só é liberado quando o
  // processo termina sozinho — só que "claude setup-token" às vezes nunca termina sozinho
  // depois de mostrar a página de sucesso no navegador, então a gente nunca via nada (nem
  // token, nem erro). O terminal virtual (implementado do lado do Rust, ver
  // "claude_setup_token_start" em src-tauri/src/lib.rs) resolve isso nos três sistemas
  // (Mac, Windows, Linux) fazendo o "claude" pensar que está rodando num terminal de verdade.
  const handleConnectClaudeSubscription = async () => {
    setClaudeCliStatus("connecting");
    setClaudeCliDebugMessage("");
    try {
      const versionCheck = await Command.create("claude-version", ["--version"]).execute();
      if (versionCheck.code !== 0 || !(versionCheck.stdout || "").trim()) {
        setClaudeCliStatus("not_found");
        setClaudeCliDebugMessage((versionCheck.stderr || "").trim());
        return;
      }
      setClaudeCliVersionInfo(versionCheck.stdout.trim());

      let stdoutBuffer = "";
      let settled = false;
      let timeoutId = null;
      let quietTimerId = null;
      // Guarda o token visto na última checagem de "silêncio", pra comparar com a próxima.
      let lastQuietToken = null;
      let unlistenOutput = null;
      let unlistenClosed = null;

      const cleanupListeners = () => {
        if (unlistenOutput) {
          unlistenOutput();
          unlistenOutput = null;
        }
        if (unlistenClosed) {
          unlistenClosed();
          unlistenClosed = null;
        }
      };

      // O terminal virtual não quebra linhas como um terminal estreito faria (a gente já abre
      // ele bem largo, do lado do Rust), mas mantemos essa limpeza de espaços como plano B —
      // o jeito principal de pegar o token é ler direto de onde o próprio "claude" guarda (ver
      // readTokenFromKeychain abaixo), que não depende de como o texto aparece na tela.
      const findToken = () => {
        const flat = stdoutBuffer.replace(/\s+/g, "");
        const match = flat.match(/sk-ant-oat\d{2}-[A-Za-z0-9_-]{20,}/);
        return match ? match[0] : "";
      };

      // Formato esperado de um token válido (com folga: o prefixo tem 2 dígitos e o corpo pelo
      // menos 40 caracteres — o real costuma ter uns 90+, mas não travamos num número exato).
      const TOKEN_FORMAT = /^sk-ant-oat\d{2}-[A-Za-z0-9_-]{40,}$/;

      // Jeito principal de pegar o token: ler direto do Chaveiro do macOS, onde o próprio
      // "claude setup-token" grava a credencial depois de autorizar com sucesso. Isso evita
      // depender de como o texto aparece no terminal virtual (que, em teoria, poderia
      // abreviar/quebrar o token na exibição, cortando ele de verdade no meio — foi exatamente
      // isso que causava o erro "OAuth access token is invalid" antes).
      const readTokenFromKeychain = async () => {
        // O Chaveiro (e o comando "security") é coisa de macOS — no Windows/Linux nem tenta,
        // já cai direto no plano B (ler o token que apareceu na tela).
        if (IS_WINDOWS) return "";
        try {
          const result = await Command.create("claude-keychain-token").execute();
          if (result.code !== 0) return "";
          const raw = (result.stdout || "").trim();
          if (!raw) return "";
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (parseErr) {
            // Não veio como JSON — se o valor guardado já for o token puro, usa direto.
            return TOKEN_FORMAT.test(raw) ? raw : "";
          }
          const token = (parsed && (parsed.claudeAiOauth?.accessToken || parsed.accessToken)) || "";
          return TOKEN_FORMAT.test(token) ? token : "";
        } catch (err) {
          return "";
        }
      };

      // O "claude" pode levar um instante pra gravar no Chaveiro depois de mostrar a mensagem
      // de sucesso na tela — por isso tenta algumas vezes antes de desistir. Se mesmo assim não
      // achar nada lá, usa o que deu pra capturar da tela como último recurso (pode vir cortado,
      // mas é melhor que nada).
      const resolveBestToken = async () => {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const fromKeychain = await readTokenFromKeychain();
          if (fromKeychain) return { token: fromKeychain, fromKeychain: true };
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
        return { token: findToken(), fromKeychain: false };
      };

      const finishOnce = (fn) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (quietTimerId) clearTimeout(quietTimerId);
        cleanupListeners();
        claudeSetupActiveRef.current = false;
        fn();
      };

      timeoutId = setTimeout(() => {
        finishOnce(() => {
          invoke("claude_setup_token_kill").catch(() => {});
          setClaudeCliStatus("not_connected");
          setClaudeCliDebugMessage(
            t("claude_setupTimeout_message") +
              (stdoutBuffer.trim()
                ? `${t("claude_setupTimeout_outputPrefix")}\n${stdoutBuffer.trim().slice(0, 600)}`
                : t("claude_setupTimeout_noOutput"))
          );
        });
      }, 30000);

      // Só considera o token "pronto" depois de ver o MESMO resultado em duas checagens seguidas,
      // com 1.2s de silêncio entre elas — isso evita finalizar cedo demais com um pedaço
      // incompleto (por exemplo, se a linha com o restante do token ainda está a caminho quando
      // a primeira pausa acontece). Cada checagem só finaliza se nada mudou desde a anterior.
      const scheduleQuietCheck = () => {
        if (quietTimerId) clearTimeout(quietTimerId);
        quietTimerId = setTimeout(() => {
          const token = findToken();
          if (token && token === lastQuietToken) {
            finishOnce(() => {
              resolveBestToken().then(({ token: resolvedToken, fromKeychain }) => {
                setClaudeOAuthToken(resolvedToken || token);
                setClaudeUseOwnLogin(Boolean(resolvedToken && fromKeychain));
                setClaudeCliStatus("connected");
              });
              invoke("claude_setup_token_kill").catch(() => {});
            });
            return;
          }
          lastQuietToken = token;
          scheduleQuietCheck();
        }, 1200);
      };

      // Ouve a saída do terminal virtual (emitida pelo lado do Rust) e o aviso de quando o
      // processo fecha sozinho.
      unlistenOutput = await listen("claude-setup-output", (event) => {
        stdoutBuffer += event.payload || "";
        // Chegou informação nova — invalida a checagem de estabilidade anterior e recomeça a
        // contagem do silêncio.
        lastQuietToken = null;
        scheduleQuietCheck();
      });

      unlistenClosed = await listen("claude-setup-closed", (event) => {
        finishOnce(() => {
          const code = typeof event.payload === "number" ? event.payload : -1;
          resolveBestToken().then(({ token, fromKeychain }) => {
            if (token) {
              setClaudeOAuthToken(token);
              setClaudeUseOwnLogin(Boolean(fromKeychain));
              setClaudeCliStatus("connected");
              return;
            }
            if (code !== 0) {
              console.error("Erro ao conectar com a Claude, código de saída:", code);
            }
            setClaudeCliStatus("not_connected");
            setClaudeCliDebugMessage(stdoutBuffer.trim().slice(0, 600));
          });
        });
      });

      claudeSetupActiveRef.current = true;
      await invoke("claude_setup_token_start");
    } catch (err) {
      console.error("Erro ao conectar com a Claude:", err);
      setClaudeCliStatus("not_found");
      setClaudeCliDebugMessage(String(err && err.message ? err.message : err));
    }
  };

  // Desconecta — apaga a credencial guardada. A pessoa pode clicar em "Conectar" de novo depois.
  // Também é usada como o link "Cancelar" enquanto está "Conectando...": aí ela realmente mata
  // o processo do "claude setup-token" em vez de só esconder a tela (antes ele continuava
  // rodando escondido, bagunçando a próxima tentativa).
  const handleDisconnectClaudeSubscription = () => {
    if (claudeSetupActiveRef.current) {
      invoke("claude_setup_token_kill").catch(() => {});
      claudeSetupActiveRef.current = false;
    }
    setClaudeOAuthToken("");
    setClaudeUseOwnLogin(false);
    setClaudeCliStatus("not_connected");
  };

  // Assim que o app abre (não só quando a pessoa visita Configurações): se já tem
  // credencial guardada de uma conexão anterior, assume conectado direto — sem isso, o
  // "Claude (sua assinatura)" só aparecia no dropdown do Composer depois de visitar
  // Configurações uma vez, porque só lá o status saía de "unchecked".
  useEffect(() => {
    if (claudeCliStatus === "unchecked" && claudeOAuthToken) {
      setClaudeCliStatus("connected");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao abrir Configurações sem credencial guardada, confere se o Claude Code está
  // instalado, pra saber se mostra o botão de conectar ou o aviso de instalação.
  useEffect(() => {
    if (currentView === "settings" && claudeCliStatus === "unchecked" && !claudeOAuthToken) {
      handleCheckClaudeCliInstalled();
    }
  }, [currentView]);

  // Se o modelo selecionado no chat deixar de estar configurado (ex: usuário apagou
  // a chave da Claude), volta automaticamente pro Ollama em vez de deixar quebrado.
  useEffect(() => {
    const availableEngines = ["Ollama (Local)"];
    if (claudeCliStatus === "connected") availableEngines.push("Claude (Assinatura)");
    if (claudeApiKey) availableEngines.push("Claude (Anthropic)");
    if (customProviderName && customProviderBaseUrl) availableEngines.push(customProviderName);
    setSelectedEngine((current) => (availableEngines.includes(current) ? current : "Ollama (Local)"));
  }, [claudeCliStatus, claudeApiKey, customProviderName, customProviderBaseUrl]);

  const hasUnsavedSettingsChanges =
    draftDesignSystemPath !== designSystemPath ||
    draftDesignSystemAdherence !== designSystemAdherence ||
    draftOllamaEndpoint !== ollamaEndpoint ||
    draftClaudeApiKey !== claudeApiKey ||
    draftGitRepoPath !== gitRepoPath ||
    draftCustomProviderName !== customProviderName ||
    draftCustomProviderBaseUrl !== customProviderBaseUrl ||
    draftCustomProviderModel !== customProviderModel ||
    draftCustomProviderApiKey !== customProviderApiKey;

  // Aplica de fato os rascunhos digitados em Configurações, salvando tudo de uma vez
  const handleSaveSettings = () => {
    setDesignSystemPath(draftDesignSystemPath);
    setDesignSystemAdherence(draftDesignSystemAdherence);
    setOllamaEndpoint(draftOllamaEndpoint);
    setClaudeApiKey(draftClaudeApiKey);
    setGitRepoPath(draftGitRepoPath);
    setCustomProviderName(draftCustomProviderName);
    setCustomProviderBaseUrl(draftCustomProviderBaseUrl);
    setCustomProviderModel(draftCustomProviderModel);
    setCustomProviderApiKey(draftCustomProviderApiKey);
    setSettingsSavedFeedback(true);
    setTimeout(() => setSettingsSavedFeedback(false), 2000);
  };

  // Abre a página de geração de chave de API do provedor no navegador padrão do usuário
  const handleOpenProviderConsole = async (url) => {
    try {
      await openUrl(url);
    } catch (err) {
      console.error("Erro ao abrir o console do provedor:", err);
    }
  };

  // Salva o relato de problema como um arquivo JSON em ~/Studio Method/relatorios/ —
  // não temos backend ainda, então isso garante que o relato não se perde (não fica só
  // na memória do app), e o próprio usuário pode nos enviar a pasta se precisar.
  const handleSubmitReport = async () => {
    if (!reportCategory || !reportDescription.trim()) return;
    setReportSubmitting(true);
    setReportFeedback("");
    try {
      const home = await homeDir();
      const reportsFolder = `${home}/Studio Method/relatorios`;
      await mkdir(reportsFolder, { recursive: true });

      const categoryDef = REPORT_CATEGORIES.find((c) => c.value === reportCategory);
      const timestamp = new Date();
      const report = {
        data: timestamp.toISOString(),
        categoria: categoryDef ? categoryDef.value : reportCategory,
        categoriaLabel: categoryDef ? categoryDef[language] || categoryDef.pt : reportCategory,
        perfil: userProfile,
        idioma: language,
        descricao: reportDescription.trim()
      };

      const fileName = `relato-${timestamp.getTime()}.json`;
      await writeTextFile(`${reportsFolder}/${fileName}`, JSON.stringify(report, null, 2));

      setReportFeedback("success");
      setReportCategory("");
      setReportDescription("");
      setTimeout(() => {
        setIsReportModalOpen(false);
        setReportFeedback("");
      }, 1500);
    } catch (err) {
      console.error("Erro ao salvar o relato de problema:", err);
      setReportFeedback("error");
    } finally {
      setReportSubmitting(false);
    }
  };

  // Retorna a lista de agentes/skills oficial de acordo com o método escolhido
  const getAgentsForMethod = (method) => {
    if (method === "Superpowers") return OFFICIAL_SUPERPOWERS_SKILLS;
    return OFFICIAL_BMAD_AGENTS;
  };

  const [selectedAgent, setSelectedAgent] = useState(() => getAgentsForMethod(selectedMethod)[0]);

  const [messages, setMessages] = useState(() => {
    const stored = loadStoredProjects();
    return stored.length > 0 ? stored[0].messages || [] : [];
  });
  const [inputMessage, setInputMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState([]);
  // true enquanto um arquivo está sendo arrastado sobre a caixa de mensagem (feedback visual)
  const [isDraggingFileOverComposer, setIsDraggingFileOverComposer] = useState(false);
  // true enquanto o agente está processando uma resposta (mostra "digitando...")
  const [isAgentTyping, setIsAgentTyping] = useState(false);

  const fileInputRef = useRef(null);
  const composerTextareaRef = useRef(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [filteredAgents, setFilteredAgents] = useState(() => getAgentsForMethod(selectedMethod));
  const composerBoxRef = useRef(null); // caixa de entrada + menu de agentes, usada para detectar clique fora
  const messagesEndRef = useRef(null); // âncora usada para rolar o chat até a última mensagem
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null); // índice da mensagem copiada, para o feedback visual do botão
  const [highlightedAgentIndex, setHighlightedAgentIndex] = useState(0); // item destacado no menu de agentes ao navegar pelo teclado

  // id do projeto que acabou de ser compartilhado/exportado, só para mostrar o feedback "✅ Exportado" por alguns segundos
  const [exportFeedbackId, setExportFeedbackId] = useState(null);
  // mensagem de aviso mostrada depois de importar um projeto recebido de outra pessoa
  const [importFeedback, setImportFeedback] = useState("");

  // Salva a lista de projetos na memória permanente sempre que ela mudar
  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (err) {
      console.error("Erro ao salvar projetos:", err);
    }
  }, [projects]);

  // Salva o perfil escolhido sempre que ele mudar
  useEffect(() => {
    try {
      if (userProfile) localStorage.setItem(USER_PROFILE_KEY, userProfile);
    } catch (err) {
      console.error("Erro ao salvar perfil do usuário:", err);
    }
  }, [userProfile]);

  // Confirma o perfil escolhido na tela pós-login e avança para a plataforma
  const handleConfirmProfile = (e) => {
    e.preventDefault();

    // A escolha de perfil marca o primeiro acesso: garante que o usuário cai numa
    // interface limpa, sem projetos de teste/sessões anteriores
    setProjects([]);
    setActiveProjectId(null);
    setMessages([]);
    setCurrentView("editor");
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify([]));
    } catch (err) {
      console.error("Erro ao limpar projetos no primeiro acesso:", err);
    }

    setUserProfile(profileSelectionDraft);
    // Guarda o perfil escolhido nos metadados da conta (Supabase), não só localmente — assim
    // ele acompanha a pessoa se ela usar o Studio Method em outro computador. Roda em segundo
    // plano; se falhar (ex: sem internet), o perfil continua funcionando localmente mesmo assim.
    supabase.auth.updateUser({ data: { profile: profileSelectionDraft } }).catch((err) => {
      console.error("Erro ao salvar o perfil na conta:", err);
    });

    // Mostra o tour de boas-vindas só na primeira vez (marcado no localStorage)
    try {
      const alreadySeen = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!alreadySeen) {
        setOnboardingStep(0);
        setIsOnboardingOpen(true);
      }
    } catch (err) {
      console.error("Erro ao checar se o onboarding já foi visto:", err);
    }
  };

  const handleCloseOnboarding = () => {
    setIsOnboardingOpen(false);
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch (err) {
      console.error("Erro ao salvar que o onboarding foi visto:", err);
    }
  };

  // Sempre que o método mudar, troca o agente/skill selecionado para o primeiro da lista correta
  useEffect(() => {
    setSelectedAgent(getAgentsForMethod(selectedMethod)[0]);
  }, [selectedMethod]);

  // Fecha o menu de agentes (/) quando o usuário clica fora da caixa de entrada
  useEffect(() => {
    if (!showMentionMenu) return;

    const handleClickOutside = (event) => {
      if (composerBoxRef.current && !composerBoxRef.current.contains(event.target)) {
        setShowMentionMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMentionMenu]);

  // Rola o chat automaticamente até a última mensagem sempre que uma nova mensagem chegar
  // ou quando o indicador de "digitando..." aparecer/desaparecer
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isAgentTyping]);

  // Salva a pasta-mãe escolhida sempre que ela mudar
  useEffect(() => {
    try {
      if (workspaceRoot) localStorage.setItem(WORKSPACE_ROOT_KEY, workspaceRoot);
    } catch (err) {
      console.error("Erro ao salvar pasta-mãe:", err);
    }
  }, [workspaceRoot]);

  // Salva o caminho do repositório Git (placeholder, ainda não funcional)
  useEffect(() => {
    try {
      localStorage.setItem(GIT_REPO_PATH_KEY, gitRepoPath || "");
    } catch (err) {
      console.error("Erro ao salvar caminho do repositório git:", err);
    }
  }, [gitRepoPath]);

  // Salva o caminho do Design System corporativo sempre que ele mudar
  useEffect(() => {
    try {
      localStorage.setItem(DESIGN_SYSTEM_PATH_KEY, designSystemPath || "");
    } catch (err) {
      console.error("Erro ao salvar caminho do design system:", err);
    }
  }, [designSystemPath]);

  // Salva o nível de aderência ao Design System sempre que ele mudar
  useEffect(() => {
    try {
      localStorage.setItem(DESIGN_SYSTEM_ADHERENCE_KEY, String(designSystemAdherence));
    } catch (err) {
      console.error("Erro ao salvar nível de aderência ao design system:", err);
    }
  }, [designSystemAdherence]);

  // Salva o endereço do servidor Ollama sempre que ele mudar
  useEffect(() => {
    try {
      localStorage.setItem(OLLAMA_ENDPOINT_KEY, ollamaEndpoint || "");
    } catch (err) {
      console.error("Erro ao salvar endereço do Ollama:", err);
    }
  }, [ollamaEndpoint]);

  // Salva a chave de API da Claude sempre que ela mudar
  useEffect(() => {
    try {
      localStorage.setItem(CLAUDE_API_KEY_KEY, claudeApiKey || "");
    } catch (err) {
      console.error("Erro ao salvar chave de API da Claude:", err);
    }
  }, [claudeApiKey]);

  // Salva a lista de diretrizes de design sempre que ela mudar
  useEffect(() => {
    try {
      localStorage.setItem(DESIGN_GUIDELINES_KEY, JSON.stringify(designGuidelines));
    } catch (err) {
      console.error("Erro ao salvar diretrizes de design:", err);
    }
  }, [designGuidelines]);

  // Garante que existe uma pasta-mãe definida. Se ainda não houver, pede para o usuário
  // escolher uma vez (via seletor nativo de pastas) e guarda essa escolha para sempre.
  const ensureWorkspaceRoot = async () => {
    if (workspaceRoot) return workspaceRoot;

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Escolha a pasta onde o Studio Method vai organizar seus projetos"
      });
      if (!selected) return null; // usuário cancelou a escolha da pasta-mãe

      setWorkspaceRoot(selected);
      return selected;
    } catch (err) {
      console.error("Erro ao escolher a pasta-mãe:", err);
      return null;
    }
  };

  // ------- DIRETRIZES DE DESIGN (documentos que os agentes devem consultar) -------
  // Lista única, sem separação entre "globais" e "do projeto": o usuário sobe o que
  // quiser e liga/desliga cada documento conforme a necessidade do momento.

  // Pasta onde os documentos de diretrizes ficam guardados de verdade
  const getDesignGuidelinesFolder = (root) => `${root}/diretrizes-de-design`;

  // Copia um arquivo escolhido pelo usuário pra dentro da pasta de diretrizes (com um
  // prefixo de timestamp pra nunca colidir com outro arquivo de mesmo nome) e devolve
  // o registro {id, name, fileName, enabled} pra guardar na lista
  const copyGuidelineFileIntoFolder = async (sourcePath, folder) => {
    await mkdir(folder, { recursive: true });
    const originalName = sourcePath.split(/[\\/]/).pop() || `documento-${Date.now()}`;
    const fileName = `${Date.now()}-${originalName}`;
    await copyFile(sourcePath, `${folder}/${fileName}`);
    return { id: fileName, name: originalName, fileName, enabled: true };
  };

  const handleAddDesignGuideline = async () => {
    const root = await ensureWorkspaceRoot();
    if (!root) return;
    try {
      const selected = await open({
        title: "Adicionar diretriz de design",
        multiple: true,
        filters: [{ name: "Documentos", extensions: ["md", "txt", "pdf", "doc", "docx"] }]
      });
      const paths = Array.isArray(selected) ? selected : (selected ? [selected] : []);
      if (paths.length === 0) return;
      const folder = getDesignGuidelinesFolder(root);
      const newDocs = [];
      for (const p of paths) {
        try {
          newDocs.push(await copyGuidelineFileIntoFolder(p, folder));
        } catch (err) {
          console.error("Erro ao copiar diretriz de design:", err);
        }
      }
      if (newDocs.length > 0) {
        setDesignGuidelines((prev) => [...prev, ...newDocs]);
      }
    } catch (err) {
      console.error("Erro ao adicionar diretriz de design:", err);
    }
  };

  const handleToggleDesignGuideline = (id) => {
    setDesignGuidelines((prev) => prev.map((d) => (d.id === id ? { ...d, enabled: !d.enabled } : d)));
  };

  const handleDeleteDesignGuideline = async (id) => {
    const doc = designGuidelines.find((d) => d.id === id);
    if (doc && workspaceRoot) {
      try {
        await remove(`${getDesignGuidelinesFolder(workspaceRoot)}/${doc.fileName}`);
      } catch (err) {
        console.error("Erro ao remover arquivo de diretriz de design:", err);
      }
    }
    setDesignGuidelines((prev) => prev.filter((d) => d.id !== id));
  };

  // Garante um nome de pasta único dentro da pasta-mãe, evitando sobrescrever projetos existentes
  const ensureUniqueFolderName = (root, baseName) => {
    const existingPaths = new Set(projects.map((p) => (p.localPath || "").toLowerCase()));
    let candidate = baseName;
    let attempt = 2;
    while (existingPaths.has(`${root}/${candidate}`.toLowerCase())) {
      candidate = `${baseName}-${attempt}`;
      attempt += 1;
    }
    return candidate;
  };

  // Traduz as mensagens de erro mais comuns do Supabase pra um texto que a pessoa entende,
  // no idioma escolhido no app.
  const friendlyAuthError = (message) => {
    const text = String(message || "");
    if (/invalid login credentials/i.test(text)) return t("auth_error_invalidCredentials");
    if (/email not confirmed/i.test(text)) return t("auth_error_emailNotConfirmed");
    if (/user already registered|already been registered/i.test(text)) return t("auth_error_alreadyRegistered");
    if (/password should be at least/i.test(text)) return t("auth_error_weakPassword");
    if (/unable to validate email address|invalid email/i.test(text)) return t("auth_error_invalidEmail");
    if (/failed to fetch|network/i.test(text)) return t("auth_error_network");
    return text || t("auth_error_generic");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput
      });
      if (error) {
        setAuthError(friendlyAuthError(error.message));
        return;
      }
      const savedProfile = data?.user?.user_metadata?.profile || null;
      setUserProfile(savedProfile);
      setIsAuthenticated(true);
    } catch (err) {
      setAuthError(friendlyAuthError(err?.message || err));
    } finally {
      setAuthLoading(false);
    }
  };

  // Manda o e-mail de "esqueci minha senha". O link leva pra uma página fora do app
  // (RESET_PASSWORD_URL) onde a pessoa digita a nova senha. Só mostramos erro pra problemas
  // óbvios (e-mail mal formatado, sem internet) — se o e-mail simplesmente não tiver conta,
  // tratamos como sucesso do mesmo jeito, pra não revelar quais e-mails têm cadastro.
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmailInput.trim(), {
        redirectTo: RESET_PASSWORD_URL
      });
      if (error && /unable to validate email address|invalid email|failed to fetch|network/i.test(String(error.message || ""))) {
        setForgotError(friendlyAuthError(error.message));
        return;
      }
      setForgotSent(true);
    } catch (err) {
      setForgotError(friendlyAuthError(err?.message || err));
    } finally {
      setForgotLoading(false);
    }
  };

  // Criar conta de verdade (Supabase). Por padrão o Supabase exige confirmação por e-mail
  // antes do primeiro login — nesse caso a pessoa não é autenticada na hora, e mostramos uma
  // tela pedindo pra ela checar o e-mail. Se a confirmação estiver desativada no projeto, a
  // sessão já vem pronta e ela entra direto.
  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmailInput.trim(),
        password: signupPasswordInput,
        options: { data: { name: signupNameInput.trim() } }
      });
      if (error) {
        setAuthError(friendlyAuthError(error.message));
        return;
      }
      if (data?.session) {
        setUserProfile(null);
        setIsAuthenticated(true);
      } else {
        // Conta criada, mas precisa confirmar o e-mail antes de poder entrar.
        setAuthScreen("confirmEmail");
      }
    } catch (err) {
      setAuthError(friendlyAuthError(err?.message || err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setNewProjectTitle("");
    setNewProjectDescription("");
    setIsModalOpen(true);
  };

  const handleConfirmCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    const root = await ensureWorkspaceRoot();
    if (!root) return; // usuário cancelou a escolha da pasta-mãe

    const folderName = ensureUniqueFolderName(root, sanitizeFolderName(newProjectTitle));
    const projectPath = `${root}/${folderName}`;

    try {
      await mkdir(projectPath, { recursive: true });
    } catch (err) {
      console.error("Erro ao criar a pasta do projeto:", err);
    }

    const newProj = {
      id: `proj-${Date.now()}`,
      title: newProjectTitle,
      description: newProjectDescription || t("no_description_provided"),
      lastModified: "Agora",
      method: "BMAD",
      engine: "Ollama (Local)",
      localPath: projectPath,
      messages: [],
      artifacts: []
    };

    setProjects([newProj, ...projects]);
    handleSelectProject(newProj);
    setIsModalOpen(false);
  };

  const handleOpenDeleteModal = (proj) => {
    setProjectToDelete(proj);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteProject = () => {
    if (!projectToDelete) return;

    const updatedProjects = projects.filter((p) => p.id !== projectToDelete.id);
    setProjects(updatedProjects);

    if (activeProjectId === projectToDelete.id) {
      if (updatedProjects.length > 0) {
        const nextProject = updatedProjects[0];
        setActiveProjectId(nextProject.id);
        setSelectedMethod(nextProject.method || "BMAD");
        setSelectedEngine(nextProject.engine || "Ollama (Local)");
        setMessages(nextProject.messages || []);
      } else {
        setActiveProjectId(null);
        setMessages([]);
      }
    }

    setIsDeleteModalOpen(false);
    setProjectToDelete(null);
  };

  const handleSelectProject = (project) => {
    setActiveProjectId(project.id);
    setSelectedMethod(project.method || "BMAD");
    setSelectedEngine(project.engine || "Ollama (Local)");
    setMessages(project.messages || []);
    setCurrentView("editor");
  };

  // Marca/desmarca um projeto como compartilhado com o Dev. Isso NÃO exporta nenhum
  // arquivo (diferente do handleExportProject) — é só uma flag interna que faz o
  // projeto aparecer na fila de priorização do perfil Dev. Ao compartilhar pela
  // primeira vez, o projeto entra no fim da fila (maior devQueueOrder + 1).
  const handleToggleShareWithDev = (proj) => {
    setProjects((prev) => {
      const isSharing = !proj.sharedWithDev;
      if (isSharing) {
        const maxOrder = prev.reduce(
          (max, p) => (p.sharedWithDev && typeof p.devQueueOrder === "number" ? Math.max(max, p.devQueueOrder) : max),
          -1
        );
        return prev.map((p) => (p.id === proj.id ? { ...p, sharedWithDev: true, devQueueOrder: maxOrder + 1 } : p));
      }
      return prev.map((p) => (p.id === proj.id ? { ...p, sharedWithDev: false } : p));
    });
  };

  // Reordena a fila do Dev trocando o devQueueOrder do projeto com o do vizinho
  // (acima ou abaixo), sem mexer em mais nada. Só atua sobre projetos com
  // sharedWithDev === true.
  const handleMoveDevQueueItem = (projectId, direction) => {
    setProjects((prev) => {
      const queue = prev
        .filter((p) => p.sharedWithDev)
        .sort((a, b) => (a.devQueueOrder ?? 0) - (b.devQueueOrder ?? 0));
      const index = queue.findIndex((p) => p.id === projectId);
      if (index === -1) return prev;
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= queue.length) return prev;

      const currentItem = queue[index];
      const swapItem = queue[swapIndex];
      const currentOrder = currentItem.devQueueOrder ?? 0;
      const swapOrder = swapItem.devQueueOrder ?? 0;

      return prev.map((p) => {
        if (p.id === currentItem.id) return { ...p, devQueueOrder: swapOrder };
        if (p.id === swapItem.id) return { ...p, devQueueOrder: currentOrder };
        return p;
      });
    });
  };

  // Exporta um projeto para um arquivo .smproj, que pode ser enviado por Teams/e-mail
  // para outro profissional (PM → PD, por exemplo) importar no Studio Method dele.
  // É a versão "Fase 1" do compartilhamento: sem nuvem, sem conta, só o arquivo mesmo.
  // O PRD vai destacado dentro do arquivo (não só como mais uma mensagem do chat),
  // pra que quem recebe consiga abrir e ler ele diretamente.
  const handleExportProject = async (proj) => {
    try {
      const suggestedName = `${sanitizeFolderName(proj.title)}.smproj`;
      const filePath = await save({
        title: "Compartilhar PRD",
        defaultPath: suggestedName,
        filters: [{ name: "Projeto Studio Method", extensions: ["smproj"] }]
      });
      if (!filePath) return; // usuário cancelou o diálogo de salvar

      // O PD só precisa do PRD atual, não do histórico de versões anteriores do PM —
      // por isso só o artefato mais recente (o mesmo que aparece como "Atual" na aba
      // Artefatos) viaja no arquivo compartilhado, nunca o histórico inteiro.
      const latestArtifact = sortArtifactsByDateDesc(proj.artifacts)[0] || null;
      const lastAgentMessage = [...(proj.messages || [])].reverse().find((m) => m.sender === "agent");
      const prdContent = latestArtifact?.content || lastAgentMessage?.text || "";

      const exportPayload = {
        smprojVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: activeProfile.label,
        project: {
          title: proj.title,
          description: proj.description,
          method: proj.method,
          engine: proj.engine,
          messages: proj.messages || [],
          artifacts: latestArtifact ? [latestArtifact] : [],
          prd: prdContent ? { title: proj.title, content: prdContent } : null
        }
      };

      await writeTextFile(filePath, JSON.stringify(exportPayload, null, 2));

      setExportFeedbackId(proj.id);
      setTimeout(() => setExportFeedbackId(null), 2500);
    } catch (err) {
      console.error("Erro ao compartilhar/exportar PRD:", err);
    }
  };

  // Importa um PRD para a lista de projetos deste computador, já pronto pra leitura
  // no painel lateral. Aceita dois formatos:
  // - .smproj: o pacote completo (PRD + histórico + metadados) vindo de outra pessoa
  // - .md/.txt: um PRD "cru", solto, sem todo o resto — o texto do arquivo vira o PRD direto
  const handleImportProject = async () => {
    try {
      const filePath = await open({
        title: "Importar PRD",
        multiple: false,
        filters: [
          { name: "PRD ou projeto Studio Method", extensions: ["smproj", "md", "txt"] }
        ]
      });
      if (!filePath) return; // usuário cancelou a escolha do arquivo

      const raw = await readTextFile(filePath);
      const isPackage = filePath.toLowerCase().endsWith(".smproj");

      // Monta os dados do projeto de forma diferente dependendo do tipo de arquivo:
      // um .smproj já vem estruturado (JSON); um .md/.txt solto vira o PRD direto.
      let projectData;
      if (isPackage) {
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.project) {
          setImportFeedback(t("import_feedback_invalid"));
          setTimeout(() => setImportFeedback(""), 4000);
          return;
        }
        projectData = parsed.project;
        projectData.exportedBy = parsed.exportedBy || null;
      } else {
        const fileName = filePath.split(/[/\\]/).pop() || "PRD importado";
        const titleFromFile = fileName.replace(/\.(md|txt)$/i, "");
        projectData = {
          title: titleFromFile,
          description: "PRD importado diretamente de um arquivo .md/.txt.",
          method: "BMAD",
          engine: selectedEngine,
          messages: [],
          artifacts: [{ name: fileName, content: raw, createdAt: new Date().toISOString() }],
          prd: { title: titleFromFile, content: raw },
          exportedBy: null
        };
      }

      // A pasta local continua funcionando por baixo dos panos, mesmo não sendo
      // mais o destaque da interface — se o usuário cancelar a escolha da pasta-mãe,
      // o PRD é importado mesmo assim, só sem uma pasta local associada.
      const root = await ensureWorkspaceRoot();
      let projectPath = "";
      const importedArtifacts = projectData.artifacts || [];
      if (root) {
        const folderName = ensureUniqueFolderName(root, sanitizeFolderName(projectData.title));
        projectPath = `${root}/${folderName}`;
        try {
          await mkdir(projectPath, { recursive: true });
          // Recria em disco, neste computador, os artefatos que vieram no arquivo
          // (o conteúdo viaja dentro do .smproj, não só o nome do arquivo)
          for (const art of importedArtifacts) {
            if (art?.name && art?.content) {
              await writeTextFile(`${projectPath}/${art.name}`, art.content);
            }
          }
        } catch (err) {
          console.error("Erro ao recriar a pasta/artefatos do PRD importado:", err);
        }
      }

      const importedProj = {
        id: `proj-${Date.now()}`,
        title: projectData.title || t("prd_imported_default_title"),
        description: projectData.description || t("no_description_provided"),
        lastModified: "Agora",
        method: projectData.method || "BMAD",
        // Respeita o modelo que o arquivo trouxer (.smproj); se não vier nenhum, usa o que
        // a pessoa já estava usando no chat, em vez de forçar de volta pro Ollama.
        engine: projectData.engine || selectedEngine,
        localPath: projectPath,
        // O contexto pra quem recebe é o próprio PRD, não a conversa que o PM teve com os
        // agentes dele — por isso o chat sempre começa vazio aqui, mesmo que o .smproj
        // carregue um histórico junto (ele fica registrado, mas não é exibido pra quem importa).
        messages: [],
        artifacts: importedArtifacts,
        prd: projectData.prd || null,
        importedFrom: projectData.exportedBy || null
      };

      // Quando é o Dev quem importa (pegando um PRD que chegou por fora, sem passar
      // pela fila), o projeto entra automaticamente compartilhado com ele mesmo —
      // senão ele não apareceria na visão de "Projetos" do Dev, que só mostra o que
      // está marcado como sharedWithDev.
      if (userProfile === "dev") {
        setProjects((prev) => {
          const maxOrder = prev.reduce(
            (max, p) => (p.sharedWithDev && typeof p.devQueueOrder === "number" ? Math.max(max, p.devQueueOrder) : max),
            -1
          );
          return [{ ...importedProj, sharedWithDev: true, devQueueOrder: maxOrder + 1 }, ...prev];
        });
      } else {
        setProjects((prev) => [importedProj, ...prev]);
      }
      handleSelectProject(importedProj);
      setCurrentView("editor");
      setActiveTab("chat");
      setImportFeedback(
        `✅ PRD "${importedProj.title}" importado${projectData.exportedBy ? ` de ${projectData.exportedBy}` : ""}.`
      );
      setTimeout(() => setImportFeedback(""), 4000);
    } catch (err) {
      console.error("Erro ao importar PRD:", err);
      setImportFeedback(t("import_feedback_failed"));
      setTimeout(() => setImportFeedback(""), 4000);
    }
  };

  // Baixa uma cópia de um artefato do projeto (o texto salvo pelo agente) para
  // onde o usuário quiser no computador, via o diálogo nativo de "Salvar como".
  const handleDownloadArtifact = async (art) => {
    try {
      // Artefatos gerados antes desta função existir têm o texto só em disco, não em
      // memória — nesse caso, lê do arquivo original antes de oferecer o download.
      let content = art.content;
      if (!content && activeProject.localPath) {
        try {
          content = await readTextFile(`${activeProject.localPath}/${art.name}`);
        } catch (readErr) {
          console.error("Erro ao ler artefato original em disco:", readErr);
        }
      }
      if (!content) {
        setImportFeedback(t("artifact_download_notFound"));
        setTimeout(() => setImportFeedback(""), 4000);
        return;
      }

      const filePath = await save({
        title: "Baixar artefato",
        defaultPath: art.name,
        filters: [{ name: "Markdown", extensions: ["md", "txt"] }]
      });
      if (!filePath) return; // usuário cancelou o diálogo de salvar

      await writeTextFile(filePath, content);
    } catch (err) {
      console.error("Erro ao baixar artefato:", err);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputMessage(val);
    handleComposerAutoResize();

    if (val.startsWith("/")) {
      const search = val.toLowerCase();
      const agentsList = getAgentsForMethod(selectedMethod);
      const filtered = agentsList.filter(
        (agent) =>
          agent.command.toLowerCase().includes(search) ||
          agent.id.toLowerCase().includes(search.replace("/", "")) ||
          agent.name.toLowerCase().includes(search.replace("/", ""))
      );
      setFilteredAgents(filtered);
      setShowMentionMenu(true);
      setHighlightedAgentIndex(0);
    } else {
      setShowMentionMenu(false);
    }
  };

  // Controla o teclado na caixa de entrada: navega pelo menu de agentes (/) com as setas
  // quando ele está aberto, ou envia a mensagem normalmente quando não está
  const handleComposerKeyDown = (e) => {
    if (showMentionMenu && filteredAgents.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedAgentIndex((prev) => (prev + 1) % filteredAgents.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedAgentIndex((prev) => (prev - 1 + filteredAgents.length) % filteredAgents.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const chosenAgent = filteredAgents[highlightedAgentIndex] || filteredAgents[0];
        handleSelectAgentCommand(chosenAgent);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    // Enter sozinho envia a mensagem; Shift+Enter quebra linha (comportamento padrão
    // do textarea, então aqui só deixamos passar sem interferir).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Faz a caixa de mensagem crescer conforme o texto tem mais linhas (até um limite),
  // em vez de manter uma altura fixa de uma linha só.
  const handleComposerAutoResize = () => {
    const el = composerTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  // Monta a instrução extra de Design System para agentes que criam interfaces,
  // de acordo com o caminho configurado e o nível de aderência escolhido em Configurações
  const buildDesignSystemInstruction = (agentToUse) => {
    if (!isDesignAgent(agentToUse) || !designSystemPath) return "";

    const mustAsk = designSystemAdherence >= 50;
    const approvalRule = mustAsk
      ? `Sempre que precisar de um componente, padrão ou estilo que NÃO existe no Design System, pare e pergunte ao usuário antes de criá-lo, no formato: "Preciso criar um componente para [finalidade]. Você autoriza a criação? (sim/não)". Só prossiga depois da resposta do usuário.`
      : `Você tem liberdade para criar componentes ou padrões novos quando necessário, sem precisar pedir autorização — mas sempre que possível, inspire-se no que já existe no Design System.`;

    return `\n\n[DESIGN SYSTEM CORPORATIVO]: O Design System oficial da empresa está disponível em: ${designSystemPath}. Sempre que for pedido para criar ou ajustar interfaces, componentes ou telas, utilize os padrões, componentes e estilos definidos nesse Design System como referência prioritária. Nível de aderência exigido pelo usuário: ${designSystemAdherence}/100 (0 = liberdade total, 100 = seguir estritamente os padrões existentes). ${approvalRule}`;
  };

  // Monta a instrução extra de Diretrizes de Design (documentos subidos pelo PD em
  // Configurações) para agentes que criam interfaces. Passa só a REFERÊNCIA (caminho
  // do arquivo), não o conteúdo extraído — quem lê de verdade é o próprio agente,
  // igual já acontece com o Design System corporativo acima. Considera só os
  // documentos que estiverem com o toggle ligado no momento do envio.
  const buildDesignGuidelinesInstruction = (agentToUse) => {
    if (!isDesignAgent(agentToUse)) return "";

    const activeDocs = designGuidelines.filter((d) => d.enabled);
    if (activeDocs.length === 0) return "";

    const folder = workspaceRoot ? getDesignGuidelinesFolder(workspaceRoot) : "";
    const docLines = activeDocs.map((d) => `- ${d.name} (${folder}/${d.fileName})`);

    return `\n\n[DIRETRIZES DE DESIGN]: Antes de criar ou ajustar protótipos, interfaces ou componentes, consulte obrigatoriamente estes documentos como guia normativo do produto (abra e leia o conteúdo real de cada um):\n${docLines.join("\n")}\nEssas diretrizes têm prioridade sobre práticas genéricas de design sempre que houver conflito.`;
  };

  // Instrução fixa de estilo, aplicada a toda resposta de agente: evita a "auto-apresentação"
  // genérica e o excesso de texto que os modelos locais costumam soltar quando só recebem
  // um comando tipo "/pm" sem contexto nenhum.
  const RESPONSE_STYLE_INSTRUCTION = `\n\n[ESTILO DE RESPOSTA]: Seja direto e objetivo. Não se apresente de forma genérica, não explique o que é o método BMad nem liste suas próprias capacidades — a menos que o usuário pergunte isso especificamente. Vá direto ao que foi pedido. Nunca invente o significado de siglas ou termos sobre os quais você não tem certeza.`;

  // Monta a instrução de contexto do PRD, quando o projeto atual tem um PRD carregado
  // (importado, ou já gerado por um agente). Na primeira mensagem da conversa, instrui
  // o agente a já abrir perguntando se deve avaliar aquele PRD específico, em vez de
  // se apresentar de forma genérica.
  const buildPrdInstruction = (targetProjectId, isFirstTurn) => {
    const targetProject = projects.find((p) => p.id === targetProjectId);
    if (!targetProject?.prd?.content) return "";

    const openingRule = isFirstTurn
      ? `Esta é a primeira mensagem da conversa: não se apresente de forma genérica. Em vez disso, comece já perguntando objetivamente se o usuário quer que você avalie, questione ou dê continuidade a este PRD específico.`
      : `Leve o conteúdo deste PRD em conta ao responder.`;

    return `\n\n[PRD ATIVO NESTE PROJETO]: O usuário está com o seguinte PRD aberto para leitura, ao lado do chat:\n"""\n${targetProject.prd.content}\n"""\n${openingRule}`;
  };

  // Marcador que o agente deve colocar sozinho na última linha da resposta sempre que
  // tiver gerado/revisado o conteúdo completo do PRD (nunca em respostas de só discussão).
  // O app detecta esse marcador, tira ele do texto exibido, e mostra os botões de
  // "Atualizar" / "Gerar novo" pro usuário decidir — em vez de tentar adivinhar a
  // resposta do usuário em texto livre, o que não seria confiável com um modelo local.
  const PRD_READY_MARKER = "[[PRD_PRONTO]]";

  const PRD_SAVE_INSTRUCTION = `\n\n[SALVAR PRD]: Sempre que você gerar ou revisar o conteúdo completo do PRD deste projeto (e não apenas responder dúvidas, perguntas ou comentários sobre ele), finalize a mensagem perguntando: "Agora que já atualizei seu PRD com as novas informações, você quer que eu gere uma nova versão ou que atualize a versão existente?" — e escreva, sozinho, na última linha da mensagem, exatamente o texto ${PRD_READY_MARKER}. NÃO inclua esse marcador quando a resposta for só discussão, dúvida ou comentário sobre o PRD.`;

  // Nome de cada idioma, por extenso, pra instruir o agente com clareza (o modelo pode
  // não reconhecer bem o código "en"/"zh" sozinho). Usado pra fazer o idioma da INTERFACE
  // também valer pro idioma das RESPOSTAS do agente — antes eram duas coisas separadas,
  // o que não fazia sentido pro usuário: se a interface está em inglês, a resposta
  // também precisa estar.
  const RESPONSE_LANGUAGE_NAMES = {
    pt: "português do Brasil",
    en: "inglês (English)",
    zh: "chinês simplificado (简体中文)"
  };
  const buildResponseLanguageInstruction = () =>
    `\n\n[IDIOMA DA RESPOSTA]: Responda sempre em ${RESPONSE_LANGUAGE_NAMES[language] || RESPONSE_LANGUAGE_NAMES.pt}, independentemente do idioma usado nas instruções de sistema acima ou na mensagem do usuário.`;

  // Função central: manda um texto para o Ollama e mostra a resposta no chat.
  // Se a resposta trouxer o marcador de PRD pronto, NÃO salva nada sozinho — em vez
  // disso, guarda o conteúdo junto da mensagem e espera o usuário escolher, clicando
  // em "Atualizar PRD atual" ou "Gerar nova versão" (handlePrdDecision cuida de salvar).
  const sendToAgent = (promptText, agentToUse, targetProjectId, targetLocalPath, isFirstTurn) => {
    const designSystemInstruction = buildDesignSystemInstruction(agentToUse);
    const designGuidelinesInstruction = buildDesignGuidelinesInstruction(agentToUse);
    const prdInstruction = buildPrdInstruction(targetProjectId, isFirstTurn);
    const systemInstruction = `${agentToUse.prompt}${RESPONSE_STYLE_INSTRUCTION}${designSystemInstruction}${designGuidelinesInstruction}${prdInstruction}${PRD_SAVE_INSTRUCTION}${buildResponseLanguageInstruction()}`;

    setIsAgentTyping(true);

    // Guarda o nome/id do agente que respondeu junto da mensagem, para que trocar de método
    // depois não altere retroativamente quem aparece no topo das bolhas antigas.
    // Quando o PRD está pronto, guarda também o conteúdo revisado + onde salvar,
    // pra usar depois quando o usuário clicar em um dos botões de decisão.
    const finishReply = (rawReply) => {
      const hasPrdReady = rawReply.includes(PRD_READY_MARKER);
      // Tira o marcador do texto mostrado ao usuário — ele é só um sinal interno
      const agentReply = hasPrdReady ? rawReply.split(PRD_READY_MARKER).join("").trim() : rawReply;
      setIsAgentTyping(false);

      setMessages((prev) => {
        const newMsgs = [
          ...prev,
          {
            sender: "agent",
            text: agentReply,
            agentName: agentToUse.name,
            agentId: agentToUse.id,
            prdDraft: hasPrdReady
              ? { content: agentReply, targetProjectId, targetLocalPath, resolved: false, resolution: null }
              : null
          }
        ];
        setProjects((pList) =>
          pList.map((p) => (p.id === targetProjectId ? { ...p, messages: newMsgs } : p))
        );
        return newMsgs;
      });
    };

    const finishError = (errorText) => {
      setIsAgentTyping(false);
      setMessages((prev) => [
        ...prev,
        { sender: "agent", text: errorText, agentName: agentToUse.name, agentId: agentToUse.id }
      ]);
    };

    // Se o modelo escolhido for "Claude (sua assinatura)", conversa com o Claude Code
    // instalado no computador do usuário — ele usa a assinatura Pro/Max já paga, sem
    // gastar crédito de API nenhum. Roda como se fosse um comando no terminal.
    if (selectedEngine === "Claude (Assinatura)" && claudeCliStatus === "connected" && claudeOAuthToken) {
      // O Claude Code (CLI) tenta interpretar qualquer mensagem que comece com "/" como um
      // comando/slash-command real dele (tipo "/bmad-pm"), que não existe nesse contexto —
      // isso gera um aviso confuso pro usuário. Os "comandos" do BMad/Superpowers aqui são só
      // um texto de ativação nosso (a persona já vem completa no --append-system-prompt),
      // então pra esse motor específico convertemos pra uma instrução em linguagem natural,
      // mantendo a bolha do chat mostrando o comando original pro usuário.
      const cliPromptText = promptText.trim().startsWith("/")
        ? `Comando "${promptText.trim()}" selecionado. Assuma o papel definido nas suas instruções de sistema acima e responda como se esta fosse a mensagem inicial da conversa.`
        : promptText;
      // Libera Write, Read, Edit, Glob e Grep — criar, ler, editar e explorar arquivos do
      // projeto, o suficiente para o agente trabalhar igual ele trabalharia dentro de uma
      // sessão do BMad/Superpowers no VS Code. Bash fica de fora por segurança (comandos de
      // terminal têm risco maior e não são essenciais pro fluxo de PRD/wireframe/documentos).
      // O diretório de trabalho do comando é a pasta do PROJETO da pessoa (targetLocalPath),
      // nunca a pasta do próprio Studio Method — assim, se o agente salvar algo com caminho
      // relativo (ex: "wireframes/home.html"), cai dentro do projeto dela, não dentro do
      // código-fonte do app (o que faria o Tauri em modo dev ficar reconstruindo à toa).
      const fileToolsInstruction =
        "\n\nVocê tem permissão para criar, ler, editar e explorar arquivos do projeto atual " +
        "(ferramentas Write, Read, Edit, Glob e Grep). Quando a pessoa pedir um arquivo " +
        "(wireframe, HTML, documento, etc.), salve-o com um caminho relativo dentro da pasta do " +
        "projeto atual (ex: \"wireframes/home.html\"), nunca em pastas do sistema, nunca em " +
        "\"src-tauri\" ou em qualquer pasta do próprio Studio Method. Depois de salvar, diga à " +
        "pessoa o caminho relativo do arquivo gerado.";
      // Continuidade de conversa: sem isso, cada mensagem virava uma chamada nova e "zerada"
      // do Claude Code, sem nenhuma memória do que já tinha sido lido/decidido nas mensagens
      // anteriores. Se já existe uma sessão salva pra esse projeto, retoma ela com --resume
      // (usando um comando registrado à parte, porque o Tauri exige que a lista de argumentos
      // bata exatamente com o que foi liberado nas permissões).
      const existingProjectForSession = projects.find((p) => p.id === targetProjectId);
      const existingCliSessionId = existingProjectForSession?.claudeCliSessionId || "";

      const baseCliArgs = [
        "-p",
        cliPromptText,
        "--append-system-prompt",
        systemInstruction + fileToolsInstruction,
        "--allowedTools",
        "Write,Read,Edit,Glob,Grep,WebFetch,WebSearch",
        "--output-format",
        "json",
        "--model",
        "sonnet"
      ];

      // Roda o comando com um limite de tempo (5 minutos) — sem isso, se o "claude" travar por
      // qualquer motivo (rede instável, processo preso, etc.), o chat fica em "digitando..."
      // pra sempre, do mesmo jeito que travava antes no fluxo de conectar a assinatura.
      const runClaudeCli = (cmdName, args, injectToken = true) =>
        new Promise((resolve, reject) => {
          const command = Command.create(cmdName, args, {
            env: injectToken && claudeOAuthToken ? { CLAUDE_CODE_OAUTH_TOKEN: claudeOAuthToken } : undefined,
            cwd: targetLocalPath || undefined
          });
          let stdout = "";
          let stderr = "";
          let settled = false;
          let child = null;

          const finish = (fn) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            fn();
          };

          const timeoutId = setTimeout(() => {
            finish(() => {
              if (child) child.kill().catch(() => {});
              reject(new Error("TIMEOUT"));
            });
          }, 300000);

          command.stdout.on("data", (line) => {
            stdout += `${line}\n`;
          });
          command.stderr.on("data", (line) => {
            stderr += `${line}\n`;
          });
          command.on("close", (data) => {
            finish(() => resolve({ code: data && typeof data.code === "number" ? data.code : -1, stdout, stderr }));
          });
          command.on("error", (err) => {
            finish(() => reject(err));
          });
          command
            .spawn()
            .then((c) => {
              child = c;
            })
            .catch((err) => {
              finish(() => reject(err));
            });
        });

      // Traduz os erros mais comuns pra uma frase que a pessoa entende e sabe o que fazer —
      // o detalhe técnico continua junto, depois de ":", pra quem quiser reportar o problema.
      const friendlyCliError = (diagnostic) => {
        const text = String(diagnostic || "");
        if (/oauth access token is invalid|401/i.test(text)) {
          return `${t("cli_error_invalidToken")}${text}`;
        }
        if (/enoent|not found|no such file/i.test(text)) {
          return `${t("cli_error_notFound")}${text}`;
        }
        return `${t("cli_error_generic")}${text}`;
      };

      // Quando a sessão retomada (--resume) não existe mais (expirou, foi apagada, etc.), o
      // "claude" recusa com uma mensagem falando de sessão/conversa. Nesse caso a gente detecta
      // e tenta de novo como uma conversa nova, em vez de mostrar um erro pra pessoa — ela nem
      // precisa notar que isso aconteceu.
      const isSessionError = (diagnostic) =>
        /no conversation found|session.*not found|invalid.*session|unknown session/i.test(String(diagnostic || ""));

      // Erro de autenticação (token expirado/inválido, sem login). Antes de pedir pra reconectar,
      // tentamos uma vez o outro jeito de autenticar: com o token guardado ou com o login do
      // próprio "claude" (que renova sozinho). Se o outro jeito funcionar, a gente lembra dele.
      const isAuthError = (diagnostic: unknown) =>
        /oauth access token (has expired|is invalid)|failed to authenticate|authentication_error|not logged in|please run \/login|\b401\b/i.test(
          String(diagnostic || "")
        );

      // useToken: injeta o token guardado (true) ou deixa o "claude" usar o próprio login (false).
      // triedOtherMode: já tentamos o outro jeito depois de um erro de autenticação (só uma vez).
      const attempt = (useResume, useToken = !claudeUseOwnLogin, triedOtherMode = false) => {
        const args =
          useResume && existingCliSessionId ? [...baseCliArgs, "--resume", existingCliSessionId] : baseCliArgs;
        const cmdName = useResume && existingCliSessionId ? "claude-agent-prompt-resume" : "claude-agent-prompt";

        runClaudeCli(cmdName, args, useToken)
          .then((result) => {
            // Tenta ler o JSON de qualquer forma — às vezes o erro vem dentro do próprio
            // JSON no stdout (ex: campo "is_error"/"result"), mesmo com código de saída != 0.
            let parsedJson = null;
            try {
              parsedJson = JSON.parse(result.stdout);
            } catch (parseErr) {
              parsedJson = null;
            }

            if (result.code !== 0 || parsedJson?.is_error) {
              const diagnostic = parsedJson?.result || result.stderr || result.stdout || "(sem detalhes do erro)";
              if (useResume && isSessionError(diagnostic)) {
                setProjects((prev) =>
                  prev.map((p) => (p.id === targetProjectId ? { ...p, claudeCliSessionId: "" } : p))
                );
                attempt(false, useToken, triedOtherMode);
                return;
              }
              if (!triedOtherMode && claudeOAuthToken && isAuthError(diagnostic)) {
                attempt(useResume, !useToken, true);
                return;
              }
              finishError(friendlyCliError(diagnostic));
              return;
            }

            // Guarda o session_id retornado, pra continuar essa mesma conversa (com toda a
            // memória do que já foi lido/feito) na próxima mensagem desse projeto.
            if (parsedJson?.session_id) {
              const newSessionId = parsedJson.session_id;
              setProjects((prev) =>
                prev.map((p) => (p.id === targetProjectId ? { ...p, claudeCliSessionId: newSessionId } : p))
              );
            }

            // Se só funcionou depois de trocar o jeito de autenticar, lembra qual é o que funciona.
            if (triedOtherMode) setClaudeUseOwnLogin(!useToken);

            const rawReply = parsedJson ? (parsedJson.result || "") : (result.stdout || "");
            finishReply(rawReply);
          })
          .catch((err) => {
            if (err?.message === "TIMEOUT") {
              finishError(t("cli_error_timeout"));
              return;
            }
            finishError(`${t("cli_error_crashed")}${err?.message || err || "desconhecido"}`);
          });
      };

      attempt(Boolean(existingCliSessionId));
      return;
    }

    // Se o modelo escolhido for a Claude e o usuário já tiver cadastrado a chave de
    // API em Configurações, conversa de verdade com a Claude (Anthropic) em vez do Ollama.
    if (selectedEngine === "Claude (Anthropic)" && claudeApiKey) {
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 2048,
          system: systemInstruction,
          messages: [{ role: "user", content: promptText }]
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.error) {
            finishError(`${t("api_error_claude_prefix")}${data.error.message || t("api_error_claude_checkKey")}`);
            return;
          }
          const rawReply = (data?.content || []).map((block) => block.text || "").join("");
          finishReply(rawReply);
        })
        .catch(() => {
          finishError(t("api_error_claude_network"));
        });
      return;
    }

    // Se o modelo escolhido for o provedor "Outro" configurado em Configurações,
    // conversa com ele usando o padrão de API da OpenAI (Chat Completions), que é
    // o formato que a maioria dos provedores compatíveis (OpenAI, LM Studio, etc.) usa.
    if (customProviderName && selectedEngine === customProviderName && customProviderBaseUrl) {
      const baseUrl = customProviderBaseUrl.trim().replace(/\/+$/, "");
      // Timeout manual — sem isso, um endpoint que não responde nunca (URL errada, servidor
      // fora do ar) deixa o chat "pensando" pra sempre, do mesmo jeito que travou antes no
      // fluxo de conectar por assinatura. 30s é tempo de sobra pra qualquer resposta normal.
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000);
      fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
          ...(customProviderApiKey ? { Authorization: `Bearer ${customProviderApiKey}` } : {})
        },
        body: JSON.stringify({
          model: (customProviderModel || "default").trim(),
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: promptText }
          ]
        })
      })
        .then(async (res) => {
          clearTimeout(timeoutId);
          // Nem todo servidor devolve JSON em erro (alguns devolvem HTML ou texto puro) —
          // sem esse try/catch, um erro de rede vira um "SyntaxError" confuso em vez da
          // mensagem clara que a pessoa precisa pra saber o que corrigir.
          let data = null;
          try {
            data = await res.json();
          } catch (parseErr) {
            data = null;
          }
          if (!res.ok) {
            const detail = data?.error?.message || `HTTP ${res.status} ${res.statusText || ""}`.trim();
            finishError(`${t("customProvider_error_prefix")} "${customProviderName}": ${detail}. ${t("customProvider_error_httpSuffix")}`);
            return;
          }
          if (data?.error) {
            finishError(`${t("customProvider_error_prefix")} "${customProviderName}": ${data.error.message || t("customProvider_error_checkConfig")}`);
            return;
          }
          const rawReply = data?.choices?.[0]?.message?.content || "";
          if (!rawReply) {
            finishError(`${t("customProvider_error_noText_prefix")} "${customProviderName}" ${t("customProvider_error_noText_suffix")}`);
            return;
          }
          finishReply(rawReply);
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          const isTimeout = err?.name === "AbortError";
          finishError(
            isTimeout
              ? `${t("customProvider_error_timeout_prefix")} "${customProviderName}" ${t("customProvider_error_timeout_suffix")}`
              : `${t("customProvider_error_offline_prefix")} "${customProviderName}". ${t("customProvider_error_offline_suffix")}`
          );
        });
      return;
    }

    fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        prompt: `[SYSTEM INSTRUCTION: ${systemInstruction}]\n\n[USER REQUEST]: ${promptText}`,
        stream: false
      })
    })
      .then((res) => res.json())
      .then((data) => finishReply(data.response || ""))
      .catch(() => finishError(t("ollama_error_notRunning")));
  };

  // Chamada quando o usuário clica em "Atualizar PRD atual" ou "Gerar nova versão" sob
  // uma resposta que trouxe um PRD pronto. "update" sobrescreve o artefato atual (a aba
  // Artefatos continua com só um item); "new" cria um artefato novo, que passa a ser o
  // "Atual", e o anterior desce pro "Histórico".
  const handlePrdDecision = async (msgIndex, decision) => {
    const msg = messages[msgIndex];
    if (!msg?.prdDraft || msg.prdDraft.resolved) return;

    const { content, targetProjectId, targetLocalPath } = msg.prdDraft;
    const project = projects.find((p) => p.id === targetProjectId);
    const existingArtifacts = project?.artifacts || [];
    const current = sortArtifactsByDateDesc(existingArtifacts)[0] || null;
    const now = new Date().toISOString();

    let savedFileName;
    let updatedArtifacts;
    if (decision === "update" && current) {
      savedFileName = current.name;
      updatedArtifacts = existingArtifacts.map((a) =>
        a.name === current.name ? { ...a, content, createdAt: now } : a
      );
    } else {
      const baseId = (agentIdForDownload(project) || "prd").toLowerCase();
      savedFileName = `${baseId}-${Date.now()}.md`;
      updatedArtifacts = [...existingArtifacts, { name: savedFileName, content, createdAt: now }];
    }

    // Se este projeto já tinha um PRD no painel lateral, mantém ele sincronizado com a versão mais recente
    const updatedPrd = project?.prd ? { ...project.prd, content } : project?.prd;

    setProjects((pList) =>
      pList.map((p) =>
        p.id === targetProjectId ? { ...p, artifacts: updatedArtifacts, prd: updatedPrd } : p
      )
    );

    if (targetLocalPath) {
      try {
        await writeTextFile(`${targetLocalPath}/${savedFileName}`, content);
      } catch (fsErr) {
        console.error("Erro ao salvar PRD em disco:", fsErr);
      }
    }

    setMessages((prev) => {
      const newMsgs = prev.map((m, i) =>
        i === msgIndex ? { ...m, prdDraft: { ...m.prdDraft, resolved: true, resolution: decision } } : m
      );
      setProjects((pList) =>
        pList.map((p) => (p.id === targetProjectId ? { ...p, messages: newMsgs } : p))
      );
      return newMsgs;
    });
  };

  // Pequeno auxiliar só pra dar um prefixo razoável ao nome do arquivo de uma nova versão
  const agentIdForDownload = (project) => (project?.method === "Superpowers" ? "prd" : "bmad-prd");

  // Garante que existe um projeto ativo antes de mandar qualquer mensagem.
  // Se o usuário for direto pro chat sem criar um projeto, cria um automaticamente
  // (pedindo só a pasta onde salvar) usando o começo da própria mensagem como título.
  const resolveActiveProject = async (firstMessageText) => {
    const existing = projects.find((p) => p.id === activeProjectId);
    if (existing) return existing;

    try {
      const root = await ensureWorkspaceRoot();
      if (!root) return null; // usuário cancelou a escolha da pasta-mãe

      const autoTitle = (firstMessageText || "Novo Projeto").replace(/^\//, "").trim().slice(0, 60) || "Novo Projeto";
      const folderName = ensureUniqueFolderName(root, sanitizeFolderName(autoTitle));
      const projectPath = `${root}/${folderName}`;

      try {
        await mkdir(projectPath, { recursive: true });
      } catch (mkdirErr) {
        console.error("Erro ao criar a pasta do projeto:", mkdirErr);
      }

      const newProj = {
        id: `proj-${Date.now()}`,
        title: autoTitle,
        description: "Criado automaticamente a partir do chat.",
        lastModified: "Agora",
        method: selectedMethod,
        engine: selectedEngine,
        localPath: projectPath,
        messages: [],
        artifacts: []
      };

      setProjects((prev) => [newProj, ...prev]);
      setActiveProjectId(newProj.id);
      return newProj;
    } catch (err) {
      console.error("Erro ao criar projeto automaticamente:", err);
      return null;
    }
  };

  const handleSelectAgentCommand = async (agent) => {
    if (isAgentTyping) return; // evita ativar outro agente enquanto o atual ainda está respondendo

    setSelectedAgent(agent);
    setShowMentionMenu(false);

    const commandText = agent.command;
    const isFirstTurn = messages.length === 0;

    const targetProject = await resolveActiveProject(commandText);
    if (!targetProject) return; // usuário cancelou a escolha da pasta

    setInputMessage("");

    const updatedMessages = [...messages, { sender: "user", text: commandText }];
    setMessages(updatedMessages);

    setProjects((prev) =>
      prev.map((p) =>
        p.id === targetProject.id ? { ...p, messages: updatedMessages, lastModified: "Agora mesmo" } : p
      )
    );

    sendToAgent(commandText, agent, targetProject.id, targetProject.localPath, isFirstTurn);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files]);
    }
  };

  const handleRemoveFile = (indexToRemove) => {
    setAttachedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Permite colar (Cmd/Ctrl+V) uma imagem copiada — de um print, de outro app, etc. —
  // direto no campo de mensagem, do mesmo jeito que já é possível anexar pelo clipe 📎.
  // Se não tiver imagem no clipboard, deixa o comportamento padrão do campo (colar texto).
  const handleComposerPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const pastedImages = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const rawFile = item.getAsFile();
        if (rawFile) {
          const extension = item.type.split("/")[1] || "png";
          // Imagens coladas vêm sem nome — damos um nome com data/hora pra identificar depois
          const named = new File([rawFile], `imagem-colada-${Date.now()}.${extension}`, { type: item.type });
          pastedImages.push(named);
        }
      }
    }

    if (pastedImages.length > 0) {
      e.preventDefault();
      setAttachedFiles((prev) => [...prev, ...pastedImages]);
    }
  };

  // Permite arrastar um arquivo (do Finder, de outra janela, etc.) e soltar direto em cima
  // da caixa de mensagem — mais uma forma de anexar, além do clipe 📎 e do colar (Cmd+V).
  const handleComposerDragOver = (e) => {
    e.preventDefault();
    if (!isDraggingFileOverComposer) setIsDraggingFileOverComposer(true);
  };

  const handleComposerDragLeave = (e) => {
    e.preventDefault();
    // Só desliga o destaque quando o mouse realmente sai da caixa (não a cada filho sobrevoado)
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDraggingFileOverComposer(false);
  };

  const handleComposerDrop = (e) => {
    e.preventDefault();
    setIsDraggingFileOverComposer(false);
    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    if (droppedFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  // Copia o texto de uma mensagem para a área de transferência e mostra um feedback rápido no botão
  const handleCopyMessage = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex((current) => (current === index ? null : current)), 1500);
    } catch (err) {
      console.error("Erro ao copiar mensagem:", err);
    }
  };

  // Botão manual de "esta resposta é o PRD" — existe porque o modelo local nem sempre
  // obedece a instrução de perguntar sozinho quando termina de gerar/revisar o PRD
  // (isso é uma limitação do modelo rodando localmente, não da lógica do app). Clicando
  // aqui, o usuário força a pergunta "Atualizar / Gerar nova versão" pra aparecer sob
  // qualquer resposta do agente, mesmo que ele não tenha sinalizado sozinho.
  const handleMarkAsPrd = (msgIndex) => {
    const msg = messages[msgIndex];
    if (!msg || msg.sender !== "agent" || msg.prdDraft) return;

    setMessages((prev) => {
      const newMsgs = prev.map((m, i) =>
        i === msgIndex
          ? {
              ...m,
              prdDraft: {
                content: m.text,
                targetProjectId: activeProject.id,
                targetLocalPath: activeProject.localPath,
                resolved: false,
                resolution: null
              }
            }
          : m
      );
      setProjects((pList) =>
        pList.map((p) => (p.id === activeProject.id ? { ...p, messages: newMsgs } : p))
      );
      return newMsgs;
    });
  };

  const handleSendMessage = async () => {
    if (isAgentTyping) return; // evita enviar outra mensagem enquanto o agente ainda está respondendo
    if (!inputMessage.trim() && attachedFiles.length === 0) return;

    setShowMentionMenu(false);

    // Resolve/cria o projeto ANTES de tratar os anexos, porque precisamos de uma pasta
    // de projeto real pra salvar os arquivos nela.
    const targetProject = await resolveActiveProject(inputMessage);
    if (!targetProject) return; // usuário cancelou a escolha da pasta

    let fullPromptText = inputMessage;

    // Salva os arquivos anexados (pelo clipe, colados com Cmd+V ou arrastados) de
    // verdade numa pasta "anexos" dentro do projeto — antes, só o NOME do arquivo era
    // mencionado em texto pro agente, sem o arquivo existir em lugar nenhum no disco,
    // então ele nunca conseguia abrir/ler o conteúdo de verdade.
    if (attachedFiles.length > 0) {
      const attachmentsFolder = `${targetProject.localPath}/anexos`;
      const savedRelativePaths = [];
      try {
        await mkdir(attachmentsFolder, { recursive: true });
      } catch (mkdirErr) {
        console.error("Erro ao criar a pasta de anexos:", mkdirErr);
      }
      for (const file of attachedFiles) {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          await writeFile(`${attachmentsFolder}/${file.name}`, bytes);
          savedRelativePaths.push(`anexos/${file.name}`);
        } catch (writeErr) {
          console.error(`Erro ao salvar o anexo "${file.name}":`, writeErr);
        }
      }
      if (savedRelativePaths.length > 0) {
        fullPromptText += `\n\n📎 [Arquivo(s) anexado(s) — já salvos de verdade no projeto, abra e leia o conteúdo real deles]: ${savedRelativePaths.join(", ")}`;
      }
    }

    const isFirstTurn = messages.length === 0;
    const userPrompt = fullPromptText;
    setInputMessage("");
    setAttachedFiles([]);
    // Depois de enviar, volta a caixa de mensagem pra altura de uma linha só
    requestAnimationFrame(() => {
      if (composerTextareaRef.current) composerTextareaRef.current.style.height = "auto";
    });

    const updatedMessages = [...messages, { sender: "user", text: fullPromptText }];
    setMessages(updatedMessages);

    setProjects((prev) =>
      prev.map((p) =>
        p.id === targetProject.id ? { ...p, messages: updatedMessages, lastModified: "Agora mesmo" } : p
      )
    );

    sendToAgent(userPrompt, selectedAgent, targetProject.id, targetProject.localPath, isFirstTurn);
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || {};

  // TEMA POR PERFIL: a estrutura visual é sempre a mesma, só a cor de destaque muda
  const activeProfile = getProfileConfig(userProfile);
  const theme = activeProfile.theme;

  // ESTILOS GLOBAIS MACPAW / GLASSMORPHISM
  const backgroundStyle = {
    background: `radial-gradient(circle at 80% 20%, ${theme.bg1} 0%, ${theme.bg2} 45%, ${theme.bg3} 100%)`,
    color: "#e2d9f3",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    // Variáveis CSS com a cor de destaque do perfil, usadas em todo o app (herdadas pelos elementos filhos)
    "--sm-accent": theme.accent,
    "--sm-accent-rgb": theme.accentRgb,
    "--sm-accent-strong": theme.accentStrong,
    "--sm-accent-strong-rgb": theme.accentStrongRgb,
    "--sm-accent-deep": theme.accentDeep,
    "--sm-secondary-rgb": theme.secondaryRgb,
    "--sm-muted": theme.muted,
    "--sm-pale": theme.pale,
    "--sm-highlight": theme.highlight,
    "--sm-soft": theme.soft,
    "--sm-icon-inactive": theme.iconInactive,
    "--sm-menu-bg": theme.menuBg
  };

  const glassCardStyle = {
    background: "rgba(255, 255, 255, 0.05)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    boxShadow: "0 12px 32px 0 rgba(0, 0, 0, 0.37)"
  };

  const glassInputStyle = {
    background: "rgba(0, 0, 0, 0.25)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    color: "#fff",
    outline: "none"
  };

  // RENDERIZAÇÃO: SPLASH / LOGIN
  // Tela neutra (preto e cinza) — a cor por perfil só entra a partir da tela de escolha de perfil,
  // que vem depois do login. Mesmo guia visual (glass, layout), só sem cor de destaque ainda.
  if (!isAuthenticated) {
    const loginBackgroundStyle = {
      background: "radial-gradient(circle at 80% 20%, #262626 0%, #141414 45%, #000000 100%)",
      color: "#e5e5e5",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif"
    };

    // Enquanto verifica se já existe uma sessão salva (evita mostrar a tela de login por um
    // instante antes de descobrir que a pessoa já estava logada)
    if (checkingSession) {
      return (
        <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", ...loginBackgroundStyle }}>
          <img src={logoStudioMethod} alt="Studio Method" style={{ width: "160px", opacity: 0.6 }} />
        </div>
      );
    }

    // TELA (depois de criar conta, se o Supabase exigir confirmação por e-mail)
    if (authScreen === "confirmEmail") {
      return (
        <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", ...loginBackgroundStyle }}>
          <div style={{ width: "100%", maxWidth: "380px", borderRadius: "20px", padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", ...glassCardStyle }}>
            <img src={logoStudioMethod} alt="Studio Method" style={{ width: "180px", marginBottom: "24px" }} />
            <h2 style={{ fontSize: "16px", color: "#fff", margin: "0 0 12px 0", textAlign: "center" }}>{t("auth_confirmEmail_title")}</h2>
            <p style={{ fontSize: "12px", color: "#a1a1aa", margin: "0 0 28px 0", textAlign: "center" }}>
              {t("auth_confirmEmail_intro")} <strong>{signupEmailInput}</strong>{t("auth_confirmEmail_outro")}
            </p>
            <button
              type="button"
              onClick={() => {
                setAuthError("");
                setAuthScreen("login");
              }}
              style={{
                width: "100%", padding: "16px", background: "linear-gradient(135deg, #52525b 0%, #18181b 100%)",
                color: "#fff", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                fontSize: "13px", fontWeight: "600", cursor: "pointer", boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5)"
              }}
            >
              {t("auth_confirmEmail_button")}
            </button>
          </div>
        </div>
      );
    }

    // TELA 1 (primeiro acesso): escolher entre criar conta ou acessar uma que já existe
    if (authScreen === "choice") {
      return (
        <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", ...loginBackgroundStyle }}>
          <div style={{ width: "100%", maxWidth: "380px", borderRadius: "20px", padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", ...glassCardStyle }}>

            <img src={logoStudioMethod} alt="Studio Method" style={{ width: "180px", marginBottom: "24px" }} />

            <h2 style={{ fontSize: "16px", color: "#fff", margin: "0 0 4px 0", textAlign: "center" }}>{t("auth_choice_title")}</h2>
            <p style={{ fontSize: "12px", color: "#a1a1aa", margin: "0 0 28px 0", textAlign: "center" }}>{t("auth_choice_subtitle")}</p>

            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  setAuthError("");
                  setAuthScreen("signup");
                }}
                style={{
                  width: "100%", padding: "16px", background: "linear-gradient(135deg, #52525b 0%, #18181b 100%)",
                  color: "#fff", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                  fontSize: "13px", fontWeight: "600", cursor: "pointer", boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5)"
                }}
              >
                {t("auth_create_account")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthError("");
                  setAuthScreen("login");
                }}
                style={{
                  width: "100%", padding: "16px", backgroundColor: "transparent",
                  color: "#e5e5e5", border: "1px solid rgba(255, 255, 255, 0.18)", borderRadius: "10px",
                  fontSize: "13px", fontWeight: "600", cursor: "pointer"
                }}
              >
                {t("auth_access_account")}
              </button>
            </div>

            <span style={{ fontSize: "11px", color: "#8a8a8a", marginTop: "28px" }}>
              v6.12.0 • macOS Glass Edition
            </span>
          </div>
        </div>
      );
    }

    // TELA 2: acessar uma conta existente
    if (authScreen === "login") {
      return (
        <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", ...loginBackgroundStyle }}>
          <div style={{ width: "100%", maxWidth: "380px", borderRadius: "20px", padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", ...glassCardStyle }}>

            <img src={logoStudioMethod} alt="Studio Method" style={{ width: "180px", marginBottom: "24px" }} />
            <h2 style={{ fontSize: "16px", color: "#fff", margin: "0 0 24px 0", textAlign: "center" }}>{t("auth_login_title")}</h2>

            <form onSubmit={handleLogin} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#d4d4d4", marginBottom: "8px", fontWeight: "500" }}>{t("auth_login_email")}</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  style={{ width: "100%", padding: "8px 16px", borderRadius: "10px", fontSize: "13px", boxSizing: "border-box", ...glassInputStyle }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#d4d4d4", marginBottom: "8px", fontWeight: "500" }}>{t("auth_login_password")}</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    placeholder={t("auth_login_password_placeholder")}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={{ width: "100%", padding: "8px 40px 8px 16px", borderRadius: "10px", fontSize: "13px", boxSizing: "border-box", ...glassInputStyle }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    title={showLoginPassword ? t("tooltip_hidePassword") : t("tooltip_showPassword")}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "var(--sm-muted)", padding: "4px" }}
                  >
                    {showLoginPassword ? "🙈" : "👁"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError("");
                    setForgotEmailInput(emailInput);
                    setForgotError("");
                    setForgotSent(false);
                    setAuthScreen("forgotPassword");
                  }}
                  style={{ display: "block", marginTop: "8px", marginLeft: "auto", background: "none", border: "none", padding: 0, color: "var(--sm-accent)", fontSize: "11px", cursor: "pointer" }}
                >
                  {t("auth_forgotPassword_link")}
                </button>
              </div>

              {authError && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: 0, textAlign: "center" }}>{authError}</p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  marginTop: "8px", width: "100%", padding: "16px",
                  background: "linear-gradient(135deg, #52525b 0%, #18181b 100%)",
                  color: "#fff", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                  fontSize: "13px", fontWeight: "600", cursor: authLoading ? "default" : "pointer",
                  boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5)", opacity: authLoading ? 0.6 : 1
                }}
              >
                {authLoading ? t("auth_loading_login") : t("auth_login_submit")}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthError("");
                  setAuthScreen("choice");
                }}
                style={{ marginTop: "4px", width: "100%", padding: "8px", backgroundColor: "transparent", color: "#a1a1aa", border: "none", fontSize: "12px", cursor: "pointer" }}
              >
                ← {t("auth_back")}
              </button>
            </form>
          </div>
        </div>
      );
    }

    // TELA (esqueci minha senha): pede o e-mail e manda o link de redefinição
    if (authScreen === "forgotPassword") {
      return (
        <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", ...loginBackgroundStyle }}>
          <div style={{ width: "100%", maxWidth: "380px", borderRadius: "20px", padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", ...glassCardStyle }}>
            <img src={logoStudioMethod} alt="Studio Method" style={{ width: "180px", marginBottom: "24px" }} />

            {forgotSent ? (
              <>
                <h2 style={{ fontSize: "16px", color: "#fff", margin: "0 0 12px 0", textAlign: "center" }}>{t("auth_forgotPassword_sentTitle")}</h2>
                <p style={{ fontSize: "12px", color: "#a1a1aa", margin: "0 0 28px 0", textAlign: "center" }}>
                  {t("auth_forgotPassword_sentIntro")} <strong>{forgotEmailInput}</strong>{t("auth_forgotPassword_sentOutro")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError("");
                    setAuthScreen("login");
                  }}
                  style={{
                    width: "100%", padding: "16px", background: "linear-gradient(135deg, #52525b 0%, #18181b 100%)",
                    color: "#fff", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                    fontSize: "13px", fontWeight: "600", cursor: "pointer", boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5)"
                  }}
                >
                  {t("auth_back")}
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: "16px", color: "#fff", margin: "0 0 12px 0", textAlign: "center" }}>{t("auth_forgotPassword_title")}</h2>
                <p style={{ fontSize: "12px", color: "#a1a1aa", margin: "0 0 24px 0", textAlign: "center" }}>
                  {t("auth_forgotPassword_intro")}
                </p>

                <form onSubmit={handleForgotPassword} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#d4d4d4", marginBottom: "8px", fontWeight: "500" }}>{t("auth_login_email")}</label>
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={forgotEmailInput}
                      onChange={(e) => setForgotEmailInput(e.target.value)}
                      autoFocus
                      style={{ width: "100%", padding: "8px 16px", borderRadius: "10px", fontSize: "13px", boxSizing: "border-box", ...glassInputStyle }}
                    />
                  </div>

                  {forgotError && (
                    <p style={{ fontSize: "12px", color: "#f87171", margin: 0, textAlign: "center" }}>{forgotError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading || !forgotEmailInput.trim()}
                    style={{
                      width: "100%", padding: "16px",
                      background: "linear-gradient(135deg, #52525b 0%, #18181b 100%)",
                      color: "#fff", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                      fontSize: "13px", fontWeight: "600",
                      cursor: (forgotLoading || !forgotEmailInput.trim()) ? "default" : "pointer",
                      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5)",
                      opacity: (forgotLoading || !forgotEmailInput.trim()) ? 0.6 : 1
                    }}
                  >
                    {forgotLoading ? t("auth_forgotPassword_loading") : t("auth_forgotPassword_submit")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthError("");
                      setAuthScreen("login");
                    }}
                    style={{ marginTop: "4px", width: "100%", padding: "8px", backgroundColor: "transparent", color: "#a1a1aa", border: "none", fontSize: "12px", cursor: "pointer" }}
                  >
                    ← {t("auth_back")}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      );
    }

    // TELA 3: criar uma conta nova
    return (
      <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", ...loginBackgroundStyle }}>
        <div style={{ width: "100%", maxWidth: "380px", borderRadius: "20px", padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", ...glassCardStyle }}>

          <img src={logoStudioMethod} alt="Studio Method" style={{ width: "180px", marginBottom: "24px" }} />
          <h2 style={{ fontSize: "16px", color: "#fff", margin: "0 0 24px 0", textAlign: "center" }}>{t("auth_signup_title")}</h2>

          <form onSubmit={handleSignup} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#d4d4d4", marginBottom: "8px", fontWeight: "500" }}>{t("auth_signup_name")}</label>
              <input
                type="text"
                placeholder={t("auth_signup_name_placeholder")}
                value={signupNameInput}
                onChange={(e) => setSignupNameInput(e.target.value)}
                style={{ width: "100%", padding: "8px 16px", borderRadius: "10px", fontSize: "13px", boxSizing: "border-box", ...glassInputStyle }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#d4d4d4", marginBottom: "8px", fontWeight: "500" }}>{t("auth_signup_email")}</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={signupEmailInput}
                onChange={(e) => setSignupEmailInput(e.target.value)}
                style={{ width: "100%", padding: "8px 16px", borderRadius: "10px", fontSize: "13px", boxSizing: "border-box", ...glassInputStyle }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", color: "#d4d4d4", marginBottom: "8px", fontWeight: "500" }}>{t("auth_signup_password")}</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showSignupPassword ? "text" : "password"}
                  placeholder={t("auth_signup_password_placeholder")}
                  value={signupPasswordInput}
                  onChange={(e) => setSignupPasswordInput(e.target.value)}
                  style={{ width: "100%", padding: "8px 40px 8px 16px", borderRadius: "10px", fontSize: "13px", boxSizing: "border-box", ...glassInputStyle }}
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword((v) => !v)}
                  title={showSignupPassword ? t("tooltip_hidePassword") : t("tooltip_showPassword")}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "var(--sm-muted)", padding: "4px" }}
                >
                  {showSignupPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {authError && (
              <p style={{ fontSize: "12px", color: "#f87171", margin: 0, textAlign: "center" }}>{authError}</p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                marginTop: "8px", width: "100%", padding: "16px",
                background: "linear-gradient(135deg, #52525b 0%, #18181b 100%)",
                color: "#fff", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                fontSize: "13px", fontWeight: "600", cursor: authLoading ? "default" : "pointer",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5)", opacity: authLoading ? 0.6 : 1
              }}
            >
              {authLoading ? t("auth_loading_signup") : t("auth_signup_submit")}
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthError("");
                setAuthScreen("choice");
              }}
              style={{ marginTop: "4px", width: "100%", padding: "8px", backgroundColor: "transparent", color: "#a1a1aa", border: "none", fontSize: "12px", cursor: "pointer" }}
            >
              ← {t("auth_back")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // RENDERIZAÇÃO: ESCOLHA DE PERFIL (primeiro acesso, logo após o login)
  if (!userProfile) {
    const previewTheme = getProfileConfig(profileSelectionDraft).theme;
    const previewBackgroundStyle = {
      background: `radial-gradient(circle at 80% 20%, ${previewTheme.bg1} 0%, ${previewTheme.bg2} 45%, ${previewTheme.bg3} 100%)`,
      color: "#e2d9f3",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif"
    };

    return (
      <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.3s ease", ...previewBackgroundStyle }}>
        <div style={{ width: "100%", maxWidth: "420px", borderRadius: "20px", padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", ...glassCardStyle }}>
          <img src={logoStudioMethod} alt="Studio Method" style={{ width: "150px", marginBottom: "16px" }} />

          <h2 style={{ fontSize: "16px", color: "#fff", margin: "0 0 4px 0", textAlign: "center" }}>{t("profile_select_title")}</h2>
          <p style={{ fontSize: "12px", color: previewTheme.muted, margin: "0 0 24px 0", textAlign: "center" }}>
            Ajustamos a interface e as ferramentas ao seu fluxo de trabalho.
          </p>

          <form onSubmit={handleConfirmProfile} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
            {PROFILES.map((profile) => {
              const isSelected = profileSelectionDraft === profile.id;
              return (
                <label
                  key={profile.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "16px 16px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    border: isSelected ? `1px solid ${profile.theme.accent}` : "1px solid rgba(255, 255, 255, 0.12)",
                    background: isSelected ? `rgba(${profile.theme.accentRgb}, 0.12)` : "rgba(255, 255, 255, 0.04)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <input
                    type="radio"
                    name="profile"
                    value={profile.id}
                    checked={isSelected}
                    onChange={() => setProfileSelectionDraft(profile.id)}
                    style={{ accentColor: profile.theme.accent, width: "16px", height: "16px" }}
                  />
                  <span style={{ fontSize: "13px", fontWeight: "600", color: isSelected ? "#fff" : "#e2d9f3" }}>{profile.label}</span>
                </label>
              );
            })}

            <button
              type="submit"
              style={{
                marginTop: "8px",
                width: "100%",
                padding: "16px",
                background: `linear-gradient(135deg, ${previewTheme.accent} 0%, ${previewTheme.accentDeep} 100%)`,
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                boxShadow: `0 4px 15px rgba(${previewTheme.accentRgb}, 0.4)`
              }}
            >
              Continuar
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Fila de projetos do Dev: só os projetos marcados como sharedWithDev,
  // ordenados por devQueueOrder (prioridade). Recalculada a cada render,
  // igual ao restante da UI — sem estado próprio, só deriva de `projects`.
  const devProjectQueue = projects
    .filter((p) => p.sharedWithDev)
    .sort((a, b) => (a.devQueueOrder ?? 0) - (b.devQueueOrder ?? 0));

  // RENDERIZAÇÃO PRINCIPAL (MACPAW GLASS LAYOUT)
  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", ...backgroundStyle }}>

      {/* FAIXA ARRASTÁVEL DO TOPO (substitui a barra nativa removida) */}
      <div
        data-tauri-drag-region
        style={{ position: "fixed", top: 0, left: 0, width: "240px", height: "36px", zIndex: 50 }}
      />

      {/* SIDEBAR GLASS */}
      <div style={{ width: "240px", display: "flex", flexDirection: "column", paddingTop: "48px", paddingRight: "16px", paddingBottom: "16px", paddingLeft: "16px", borderRight: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(0, 0, 0, 0.15)", backdropFilter: "blur(30px)" }}>

        {/* CABEÇALHO */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "16px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <img src={logoStudioMethod} alt="Studio Method" style={{ height: "22px" }} />
          <span
            style={{
              alignSelf: "flex-start",
              fontSize: "10px",
              fontWeight: "700",
              color: "var(--sm-accent)",
              background: "rgba(var(--sm-accent-rgb), 0.15)",
              border: "1px solid rgba(var(--sm-accent-rgb), 0.3)",
              borderRadius: "999px",
              padding: "4px 8px",
              textTransform: "uppercase",
              letterSpacing: "0.03em"
            }}
          >
            {activeProfile.label}
          </span>
        </div>

        {/* MENU */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
          <button
            onClick={handleOpenCreateModal}
            style={{
              background: "linear-gradient(135deg, var(--sm-accent) 0%, var(--sm-accent-strong) 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "8px",
              boxShadow: "0 4px 12px rgba(var(--sm-accent-strong-rgb), 0.3)"
            }}
          >
            <span>+</span> {t("nav_newProject")}
          </button>

          {(userProfile === "pm" || userProfile === "pd" || userProfile === "dev") && (
            <button
              onClick={handleImportProject}
              title={t("import_prd_title")}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                color: "var(--sm-highlight)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "10px",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginBottom: "8px"
              }}
            >
              <span>📥</span> {t("nav_importPrd")}
            </button>
          )}

          <button
            onClick={() => setCurrentView("editor")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: currentView === "editor" ? "rgba(255, 255, 255, 0.12)" : "transparent",
              color: currentView === "editor" ? "var(--sm-highlight)" : "var(--sm-icon-inactive)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "500",
              textAlign: "left"
            }}
          >
            <span>💬</span> {t("nav_composerChat")}
          </button>

          <button
            onClick={() => setCurrentView("projects")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: currentView === "projects" ? "rgba(255, 255, 255, 0.12)" : "transparent",
              color: currentView === "projects" ? "var(--sm-highlight)" : "var(--sm-icon-inactive)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "500",
              textAlign: "left"
            }}
          >
            <span>📁</span> {t("nav_explorerProjects")}
          </button>

          <button
            onClick={() => setCurrentView("settings")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: currentView === "settings" ? "rgba(255, 255, 255, 0.12)" : "transparent",
              color: currentView === "settings" ? "var(--sm-highlight)" : "var(--sm-icon-inactive)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "500",
              textAlign: "left"
            }}
          >
            <span>⚙️</span> {t("nav_settings")}
          </button>
        </div>

        {/* RODAPÉ SIDEBAR */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={() => {
              setReportCategory("");
              setReportDescription("");
              setReportFeedback("");
              setIsReportModalOpen(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              color: "var(--sm-muted)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "11px"
            }}
          >
            {t("report_button")}
          </button>
          <button
            onClick={() => {
              supabase.auth.signOut().catch((err) => console.error("Erro ao sair da conta:", err));
              setIsAuthenticated(false);
              setUserProfile(null);
              setAuthScreen("choice");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              color: "var(--sm-muted)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "11px"
            }}
          >
            🚪 {t("nav_logout")}
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* EXPLORER PROJETO */}
        {currentView === "projects" && (
          <div style={{ padding: "32px", overflowY: "auto", flex: 1, maxWidth: "1280px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
            <div style={{ marginBottom: "24px" }}>
              <h1 style={{ fontSize: "22px", margin: "0 0 4px 0", fontWeight: "600", color: "#fff" }}>
                {t("projects_title")}
              </h1>
              <p style={{ margin: 0, color: "var(--sm-muted)", fontSize: "13px" }}>
                {userProfile === "dev" ? t("dev_queue_subtitle") : t("projects_subtitle")}
              </p>
            </div>

            {importFeedback && (
              <div
                style={{
                  marginBottom: "16px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "var(--sm-highlight)",
                  background: "rgba(var(--sm-accent-rgb), 0.12)",
                  border: "1px solid rgba(var(--sm-accent-rgb), 0.3)"
                }}
              >
                {importFeedback}
              </div>
            )}

            {userProfile === "dev" ? (
              devProjectQueue.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--sm-muted)", lineHeight: "1.5" }}>{t("dev_queue_empty")}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {devProjectQueue.map((proj, index) => (
                    <div
                      key={proj.id}
                      style={{
                        borderRadius: "16px",
                        padding: "20px 24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "16px",
                        ...glassCardStyle,
                        border: proj.id === activeProjectId ? "1px solid var(--sm-accent)" : "1px solid rgba(255,255,255,0.1)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0 }}>
                        <div
                          title={t("dev_queue_priority")}
                          style={{
                            flexShrink: 0,
                            width: "32px",
                            height: "32px",
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "13px",
                            fontWeight: "600",
                            backgroundColor: "rgba(var(--sm-accent-rgb), 0.16)",
                            color: "var(--sm-highlight)",
                            border: "1px solid rgba(var(--sm-accent-rgb), 0.3)"
                          }}
                        >
                          {index + 1}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <h3 style={{ margin: 0, fontSize: "15px", color: "#fff", fontWeight: "600" }}>{proj.title}</h3>
                            {proj.id === activeProjectId && (
                              <span style={{ fontSize: "10px", backgroundColor: "var(--sm-accent-deep)", color: "var(--sm-highlight)", padding: "4px 8px", borderRadius: "12px", border: "1px solid var(--sm-accent)" }}>
                                {t("badge_active")}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: "12px", color: "#cbd5e1", margin: "0 0 8px 0", lineHeight: "1.4" }}>{proj.description}</p>
                          <div style={{ fontSize: "11px", color: "var(--sm-muted)", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <span>⚙️ {proj.method}</span>
                            <span>🤖 {proj.engine}</span>
                            {proj.importedFrom && <span>📥 {t("badge_receivedFrom")} {proj.importedFrom}</span>}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <button
                          onClick={() => handleMoveDevQueueItem(proj.id, "up")}
                          disabled={index === 0}
                          title={t("move_up")}
                          style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", color: "#fff", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "8px", padding: "4px 8px", fontSize: "11px", cursor: index === 0 ? "default" : "pointer", opacity: index === 0 ? 0.35 : 1 }}
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => handleMoveDevQueueItem(proj.id, "down")}
                          disabled={index === devProjectQueue.length - 1}
                          title={t("move_down")}
                          style={{ backgroundColor: "rgba(255, 255, 255, 0.08)", color: "#fff", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "8px", padding: "4px 8px", fontSize: "11px", cursor: index === devProjectQueue.length - 1 ? "default" : "pointer", opacity: index === devProjectQueue.length - 1 ? 0.35 : 1 }}
                        >
                          ▼
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(proj)}
                          title={t("btn_delete")}
                          style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                        >
                          🗑️
                        </button>
                        <button
                          onClick={() => handleSelectProject(proj)}
                          style={{ backgroundColor: "rgba(255, 255, 255, 0.15)", color: "#fff", border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "8px", padding: "4px 16px", fontSize: "11px", cursor: "pointer" }}
                        >
                          {t("btn_open")} →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    style={{
                      borderRadius: "16px",
                      padding: "24px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "16px",
                      ...glassCardStyle,
                      border: proj.id === activeProjectId ? "1px solid var(--sm-accent)" : "1px solid rgba(255,255,255,0.1)"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "15px", color: "#fff", fontWeight: "600" }}>{proj.title}</h3>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                          {proj.id === activeProjectId && (
                            <span style={{ fontSize: "10px", backgroundColor: "var(--sm-accent-deep)", color: "var(--sm-highlight)", padding: "4px 8px", borderRadius: "12px", border: "1px solid var(--sm-accent)", whiteSpace: "nowrap" }}>
                              {t("badge_active")}
                            </span>
                          )}
                          {proj.sharedWithDev && (
                            <span style={{ fontSize: "10px", backgroundColor: "rgba(52, 211, 153, 0.14)", color: "#6ee7b7", padding: "4px 8px", borderRadius: "12px", border: "1px solid rgba(52, 211, 153, 0.35)", whiteSpace: "nowrap" }}>
                              {t("shared_with_dev_badge")}
                            </span>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: "12px", color: "#cbd5e1", margin: "0 0 16px 0", lineHeight: "1.4" }}>{proj.description}</p>
                      <div style={{ fontSize: "11px", color: "var(--sm-muted)", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span>⚙️ {proj.method}</span>
                        <span>🤖 {proj.engine}</span>
                        {proj.importedFrom && <span>📥 {t("badge_receivedFrom")} {proj.importedFrom}</span>}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <span style={{ fontSize: "11px", color: "var(--sm-muted)" }}>{proj.lastModified}</span>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <button
                          onClick={() => handleOpenDeleteModal(proj)}
                          title={t("delete_modal_title")}
                          style={{
                            flex: "0 1 auto", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", overflow: "hidden",
                            backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#fca5a5",
                            border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "9px 12px", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap"
                          }}
                        >
                          🗑️ {t("btn_delete")}
                        </button>

                        {(userProfile === "pm" || userProfile === "pd") && (
                          <button
                            onClick={() => handleToggleShareWithDev(proj)}
                            style={{
                              flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", overflow: "hidden",
                              backgroundColor: proj.sharedWithDev ? "rgba(52, 211, 153, 0.14)" : "rgba(255, 255, 255, 0.08)",
                              color: proj.sharedWithDev ? "#6ee7b7" : "var(--sm-highlight)",
                              border: proj.sharedWithDev ? "1px solid rgba(52, 211, 153, 0.35)" : "1px solid rgba(255, 255, 255, 0.15)",
                              borderRadius: "8px", padding: "9px 12px", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap", textOverflow: "ellipsis"
                            }}
                          >
                            {proj.sharedWithDev ? t("shared_with_dev_badge") : t("share_with_dev_button")}
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => handleSelectProject(proj)}
                        style={{
                          width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
                          backgroundColor: "rgba(255, 255, 255, 0.15)", color: "#fff", border: "1px solid rgba(255, 255, 255, 0.2)",
                          borderRadius: "8px", padding: "9px 16px", fontSize: "12px", fontWeight: "600", cursor: "pointer"
                        }}
                      >
                        {t("btn_open")} →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONFIGURAÇÕES */}
        {currentView === "settings" && (
          <div style={{ flex: 1, overflowY: "auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ padding: "32px", maxWidth: "500px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
            <h1 style={{ fontSize: "22px", margin: "0 0 4px 0", fontWeight: "600", color: "#fff" }}>{t("settings_title")}</h1>
            <p style={{ color: "var(--sm-muted)", fontSize: "13px", marginBottom: "24px" }}>{t("settings_subtitle")}</p>

            {/* CARD: IDIOMA — vale para os três perfis, por isso não entra no
                SETTINGS_CARD_VISIBILITY (fica sempre visível). */}
            <div style={{ padding: "24px", borderRadius: "16px", marginBottom: "16px", ...glassCardStyle }}>
              <label style={{ display: "block", fontSize: "12px", color: "var(--sm-accent)", marginBottom: "8px" }}>{t("settings_language_label")}</label>
              <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 8px 0" }}>{t("settings_language_desc")}</p>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ width: "100%", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", ...glassInputStyle }}
              >
                {AVAILABLE_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.label}</option>
                ))}
              </select>
            </div>

            {/* CARD: ATUALIZAÇÕES — vale para os três perfis, sempre visível (assim como o
                de Idioma). Mostra a versão atual e, se houver uma nova, o botão pra instalar. */}
            <div style={{ padding: "24px", borderRadius: "16px", marginBottom: "16px", ...glassCardStyle }}>
              <label style={{ display: "block", fontSize: "12px", color: "var(--sm-accent)", marginBottom: "8px" }}>{t("settings_update_title")}</label>
              <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 12px 0" }}>
                {t("settings_update_currentVersion")} {appVersion || "…"}
              </p>

              {updateCheckStatus === "available" && updateInfo && (
                <p style={{ fontSize: "12px", color: "var(--sm-highlight)", margin: "0 0 12px 0" }}>
                  {t("settings_update_available")} (v{updateInfo.version})
                </p>
              )}
              {updateCheckStatus === "upToDate" && (
                <p style={{ fontSize: "12px", color: "var(--sm-muted)", margin: "0 0 12px 0" }}>{t("settings_update_upToDate")}</p>
              )}
              {updateCheckStatus === "error" && (
                <p style={{ fontSize: "12px", color: "#fca5a5", margin: "0 0 12px 0" }}>{t("settings_update_error")}</p>
              )}
              {updateInstallStatus === "error" && updateInstallError && (
                <p style={{ fontSize: "11px", color: "#fca5a5", margin: "0 0 12px 0" }}>{t("update_install_error")}</p>
              )}

              {updateCheckStatus === "available" && updateInfo ? (
                <button
                  type="button"
                  onClick={handleInstallUpdate}
                  disabled={updateInstallStatus === "downloading" || updateInstallStatus === "installing"}
                  style={{ width: "100%", padding: "8px 16px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, var(--sm-accent) 0%, var(--sm-accent-deep) 100%)", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: updateInstallStatus === "downloading" || updateInstallStatus === "installing" ? "default" : "pointer", opacity: updateInstallStatus === "downloading" || updateInstallStatus === "installing" ? 0.7 : 1 }}
                >
                  {updateInstallStatus === "downloading" || updateInstallStatus === "installing" ? t("update_installing_title") : t("settings_update_installButton")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCheckForUpdates(false)}
                  disabled={updateCheckStatus === "checking"}
                  style={{ width: "100%", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", cursor: updateCheckStatus === "checking" ? "default" : "pointer", boxSizing: "border-box", ...glassInputStyle }}
                >
                  {updateCheckStatus === "checking" ? t("settings_update_checking") : t("settings_update_checkButton")}
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* CARD: ONDE OS PROJETOS FICAM GUARDADOS — Pasta raiz e Repositório na nuvem são a
                  mesma ideia (onde o Studio Method guarda/sincroniza os projetos), então dividimos
                  em abas em vez de empilhar os dois. */}
              {isSettingsCardVisibleForProfile("storage", userProfile) && (
              <div style={{ padding: "24px", borderRadius: "16px", ...glassCardStyle }}>
                <div style={{ display: "flex", gap: "4px", marginBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <button
                    type="button"
                    onClick={() => setStorageSettingsTab("pasta")}
                    style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: storageSettingsTab === "pasta" ? "2px solid var(--sm-accent)" : "2px solid transparent", color: storageSettingsTab === "pasta" ? "#fff" : "var(--sm-muted)", fontSize: "12px", fontWeight: "600", cursor: "pointer", marginBottom: "-1px" }}
                  >
                    {t("settings_rootFolder_label")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStorageSettingsTab("repo")}
                    style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: storageSettingsTab === "repo" ? "2px solid var(--sm-accent)" : "2px solid transparent", color: storageSettingsTab === "repo" ? "#fff" : "var(--sm-muted)", fontSize: "12px", fontWeight: "600", cursor: "pointer", marginBottom: "-1px" }}
                  >
                    {t("settings_cloudRepo_label")}
                  </button>
                </div>

                {storageSettingsTab === "pasta" && (
                  <div>
                    <span style={{ display: "inline-block", fontSize: "9px", fontWeight: "700", color: "var(--sm-muted)", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "999px", padding: "4px 8px", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "8px" }}>
                      {t("settings_localMode_badge")}
                    </span>
                    <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 8px 0" }}>
                      {t("settings_projectsFolder_desc")}
                    </p>
                    <button
                      type="button"
                      onClick={ensureWorkspaceRoot}
                      style={{ width: "100%", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", textAlign: "left", cursor: "pointer", boxSizing: "border-box", ...glassInputStyle }}
                    >
                      {workspaceRoot ? `📁 ${workspaceRoot}` : "📁 Clique para escolher a pasta..."}
                    </button>
                    {workspaceRoot && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const selected = await open({ directory: true, multiple: false, title: t("folder_picker_new_root_title") });
                            if (selected) setWorkspaceRoot(selected);
                          } catch (err) {
                            console.error("Erro ao trocar a pasta-mãe:", err);
                          }
                        }}
                        style={{ marginTop: "8px", padding: "0", background: "none", border: "none", color: "var(--sm-accent)", fontSize: "11px", cursor: "pointer", textDecoration: "underline" }}
                      >
                        Alterar pasta
                      </button>
                    )}
                  </div>
                )}

                {storageSettingsTab === "repo" && (
                  <div>
                    <span style={{ display: "inline-block", fontSize: "9px", fontWeight: "700", color: "var(--sm-soft)", background: "rgba(var(--sm-accent-rgb), 0.15)", border: "1px solid rgba(var(--sm-accent-rgb), 0.3)", borderRadius: "999px", padding: "4px 8px", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "8px" }}>
                      Em breve
                    </span>
                    <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 8px 0" }}>
                      Vincule uma URL do GitHub ou GitLab para sincronizar seus projetos na nuvem.
                    </p>
                    <input
                      type="text"
                      placeholder={t("settings_gitRepo_placeholder")}
                      value={draftGitRepoPath}
                      onChange={(e) => setDraftGitRepoPath(e.target.value)}
                      style={{ width: "100%", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", ...glassInputStyle }}
                    />
                  </div>
                )}
              </div>
              )}

              {/* CARD: DESIGN SYSTEM (referência + rigor — mesmo tema, ficam juntos) — só faz
                  sentido pra quem cria (PD) ou implementa (Dev) telas; PM não vê esse card. */}
              {isSettingsCardVisibleForProfile("designSystem", userProfile) && (
              <div style={{ padding: "24px", borderRadius: "16px", ...glassCardStyle }}>
                <label style={{ display: "block", fontSize: "12px", color: "var(--sm-accent)", marginBottom: "8px" }}>{t("settings_designSystem_label")}</label>
                <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 8px 0" }}>
                  {t("settings_designSystem_desc")}
                </p>
                <input
                  type="text"
                  placeholder={t("settings_designSystem_placeholder")}
                  value={draftDesignSystemPath}
                  onChange={(e) => setDraftDesignSystemPath(e.target.value)}
                  style={{ width: "100%", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", ...glassInputStyle }}
                />

                <div style={{ marginTop: "16px" }}>
                  <label style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--sm-accent)", marginBottom: "8px" }}>
                    <span>{t("settings_adherence_label")}</span>
                    <span style={{ color: "var(--sm-highlight)", fontWeight: "600" }}>{draftDesignSystemAdherence}/100</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={draftDesignSystemAdherence}
                    onChange={(e) => setDraftDesignSystemAdherence(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--sm-accent)", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--sm-muted)", marginTop: "4px" }}>
                    <span>{t("settings_adherence_free")}</span>
                    <span>{t("settings_adherence_strict")}</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--sm-pale)", marginTop: "8px", marginBottom: 0 }}>
                    {getAdherenceLabel(draftDesignSystemAdherence, language)}
                  </p>
                  <p style={{ fontSize: "10px", color: "var(--sm-muted)", marginTop: "8px", marginBottom: 0 }}>
                    {t("settings_adherence_note")}
                  </p>
                </div>
              </div>
              )}

              {/* CARD: DIRETRIZES DE DESIGN (documentos) — complementa o slider acima: em vez
                  de uma configuração abstrata, o PD sobe documentos concretos (guias de marca,
                  princípios de UX etc.) que os agentes devem consultar como guia obrigatório
                  sempre que forem criar protótipos. Só o PD vê esse card. */}
              {isSettingsCardVisibleForProfile("designGuidelines", userProfile) && (
                <div style={{ padding: "24px", borderRadius: "16px", ...glassCardStyle }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <label style={{ fontSize: "12px", color: "var(--sm-accent)" }}>{t("settings_designGuidelines_label")}</label>
                    <button
                      type="button"
                      onClick={handleAddDesignGuideline}
                      style={{ padding: "4px 10px", background: "none", border: "1px dashed rgba(255,255,255,0.25)", borderRadius: "6px", color: "var(--sm-accent)", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
                    >
                      {t("settings_designGuidelines_addButton")}
                    </button>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 4px 0" }}>
                    {t("settings_designGuidelines_desc")}
                  </p>
                  <p style={{ fontSize: "10px", color: "var(--sm-pale)", margin: "0 0 16px 0" }}>
                    {t("settings_designGuidelines_shortHint")}
                  </p>

                  {designGuidelines.length === 0 ? (
                    <p style={{ fontSize: "11px", color: "var(--sm-muted)", fontStyle: "italic", margin: 0 }}>{t("settings_designGuidelines_empty")}</p>
                  ) : (
                    designGuidelines.map((doc) => (
                      <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", marginBottom: "6px" }}>
                        <input
                          type="checkbox"
                          checked={doc.enabled}
                          onChange={() => handleToggleDesignGuideline(doc.id)}
                          style={{ accentColor: "var(--sm-accent)", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ flex: 1, fontSize: "12px", color: doc.enabled ? "#fff" : "var(--sm-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteDesignGuideline(doc.id)}
                          title={t("tooltip_remove")}
                          style={{ width: "18px", height: "18px", borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "var(--sm-muted)", fontSize: "11px", lineHeight: "18px", textAlign: "center", padding: 0, cursor: "pointer", flexShrink: 0 }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>

            {/* MOTORES DE IA — um card só. Cada motor já conectado vira um chip (nome + X pra
                remover); pra conectar um motor novo, um botão abre um passo a passo curto.
                Todo mundo escolhe o motor de IA, então esse bloco é visível pros três perfis. */}
            {isSettingsCardVisibleForProfile("aiModels", userProfile) && (() => {
              const isClaudeSubscriptionAdded = claudeCliStatus === "connected";
              const isClaudeApiKeyAdded = Boolean(draftClaudeApiKey);
              const isCustomProviderAdded = Boolean(draftCustomProviderName && draftCustomProviderBaseUrl);
              const engineChip = (key, icon, label, onRemove) => (
                <div key={key} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 8px 6px 12px", borderRadius: "999px", border: "1px solid rgba(134, 239, 172, 0.3)", background: "rgba(134, 239, 172, 0.08)" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#86efac", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#fff", whiteSpace: "nowrap" }}>{icon} {label}</span>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={onRemove}
                      title={t("tooltip_remove")}
                      style={{ width: "18px", height: "18px", borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "var(--sm-muted)", fontSize: "11px", lineHeight: "18px", textAlign: "center", padding: 0, cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
              return (
                <div style={{ marginTop: "24px" }}>
                  <h3 style={{ fontSize: "12px", color: "var(--sm-accent)", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("settings_aiModels_title")}</h3>
                  <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 16px 0" }}>
                    {t("settings_aiModels_subtitle")}
                  </p>

                  <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                    <button
                      type="button"
                      onClick={() => { setAddEngineSelection(null); setClaudeAddMethod(null); setIsEngineDropdownOpen(true); setAddEngineSearch(""); setIsAddEngineModalOpen(true); }}
                      style={{ padding: "8px 16px", marginBottom: "14px", background: "none", border: "1px dashed rgba(255,255,255,0.25)", borderRadius: "8px", color: "var(--sm-accent)", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                    >
                      + Adicionar motor de IA
                    </button>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {isOllamaEngineAdded && engineChip("ollama", "🦙", "Ollama (Local)", () => setIsOllamaEngineAdded(false))}
                      {isClaudeSubscriptionAdded && engineChip("claude-sub", "🔐", "Claude (assinatura)", handleDisconnectClaudeSubscription)}
                      {isClaudeApiKeyAdded && engineChip("claude-api", "🔑", "Claude (chave de API)", () => setDraftClaudeApiKey(""))}
                      {isCustomProviderAdded && engineChip("custom", "🔌", draftCustomProviderName, () => {
                        setDraftCustomProviderName("");
                        setDraftCustomProviderBaseUrl("");
                        setDraftCustomProviderModel("");
                        setDraftCustomProviderApiKey("");
                      })}
                    </div>
                  </div>

                  {isAddEngineModalOpen && (() => {
                    const closeModal = () => {
                      setIsAddEngineModalOpen(false);
                      setAddEngineSelection(null);
                      setClaudeAddMethod(null);
                      setIsEngineDropdownOpen(false);
                      setAddEngineSearch("");
                    };
                    const searchLower = addEngineSearch.trim().toLowerCase();
                    const filteredEngines = KNOWN_AI_ENGINES.filter((engine) => {
                      return !searchLower || engine.label.toLowerCase().includes(searchLower);
                    });
                    const hasExactMatch = filteredEngines.some((engine) => engine.label.toLowerCase() === searchLower);
                    const pickEngine = (engine) => {
                      setIsEngineDropdownOpen(false);
                      setAddEngineSearch("");
                      setClaudeAddMethod(null);
                      setAddEngineSelection(engine);
                      if (engine.kind === "custom") {
                        setDraftCustomProviderName(engine.label);
                        setDraftCustomProviderBaseUrl(engine.baseUrl || "");
                      }
                      // Ollama entra na lista igual aos outros motores — em vez de já adicionar e
                      // fechar sozinho, mostra o campo de endereço (endpoint) pra pessoa confirmar
                      // ou trocar, com o mesmo padrão de "Salvar" dos demais.
                    };
                    const clearSelection = () => {
                      setAddEngineSelection(null);
                      setClaudeAddMethod(null);
                      setIsEngineDropdownOpen(true);
                    };
                    const handleFooterBack = () => {
                      if (addEngineSelection?.kind === "claude" && claudeAddMethod) { setClaudeAddMethod(null); return; }
                      if (addEngineSelection) { clearSelection(); return; }
                      closeModal();
                    };
                    const isSaveVisible = addEngineSelection?.kind === "custom" || addEngineSelection?.kind === "ollama" || (addEngineSelection?.kind === "claude" && claudeAddMethod === "apikey");
                    const isSaveEnabled = addEngineSelection?.kind === "custom"
                      ? Boolean(draftCustomProviderName && draftCustomProviderBaseUrl)
                      : addEngineSelection?.kind === "ollama"
                      ? Boolean(draftOllamaEndpoint)
                      : Boolean(draftClaudeApiKey);
                    const handleSaveEngine = () => {
                      if (addEngineSelection?.kind === "ollama") {
                        setIsOllamaEngineAdded(true);
                      }
                      closeModal();
                    };
                    return (
                      <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ width: "380px", maxWidth: "90vw", padding: "20px", borderRadius: "14px", background: "var(--sm-panel, #14172a)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <h3 style={{ fontSize: "14px", color: "#fff", margin: "0 0 4px 0" }}>{t("addEngine_modal_title")}</h3>
                          <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 12px 0" }}>{t("settings_aiEngine_searchPlaceholder")}</p>

                          {/* COMBOBOX — fechado mostra "Selecione o motor" ou o motor escolhido (com X pra
                              trocar); clicando nele (quando vazio) abre a busca + lista logo abaixo, sem
                              trocar de tela. */}
                          <div style={{ position: "relative", marginBottom: addEngineSelection ? "16px" : (isEngineDropdownOpen ? "0" : "16px") }}>
                            <button
                              type="button"
                              onClick={() => { if (!addEngineSelection) setIsEngineDropdownOpen((open) => !open); }}
                              style={{ width: "100%", boxSizing: "border-box", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: "13px", cursor: addEngineSelection ? "default" : "pointer" }}
                            >
                              {addEngineSelection ? (
                                <>
                                  <span style={{ fontWeight: "600" }}>{addEngineSelection.icon} {addEngineSelection.label}</span>
                                  <span
                                    role="button"
                                    onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                                    title={t("tooltip_changeEngine")}
                                    style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", fontSize: "11px", lineHeight: "20px", textAlign: "center" }}
                                  >
                                    ✕
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: "var(--sm-muted)" }}>{t("engine_select_placeholder")}</span>
                                  <span style={{ fontSize: "11px", color: "var(--sm-muted)" }}>{isEngineDropdownOpen ? "▴" : "▾"}</span>
                                </>
                              )}
                            </button>

                            {isEngineDropdownOpen && !addEngineSelection && (
                              <div style={{ marginTop: "8px", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder={t("engine_search_placeholder")}
                                  value={addEngineSearch}
                                  onChange={(e) => setAddEngineSearch(e.target.value)}
                                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", marginBottom: "8px", ...glassInputStyle }}
                                />
                                <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                                  {filteredEngines.map((engine) => (
                                    <button
                                      key={engine.id}
                                      type="button"
                                      onClick={() => pickEngine(engine)}
                                      style={{ width: "100%", boxSizing: "border-box", textAlign: "left", padding: "10px 12px", marginBottom: "6px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                                    >
                                      {engine.icon} {engine.label}
                                    </button>
                                  ))}
                                  {addEngineSearch && !hasExactMatch && (
                                    <button
                                      type="button"
                                      onClick={() => pickEngine({ id: `custom-${addEngineSearch.trim()}`, label: addEngineSearch.trim(), icon: "🔌", kind: "custom", baseUrl: "" })}
                                      style={{ width: "100%", boxSizing: "border-box", textAlign: "left", padding: "10px 12px", borderRadius: "6px", border: "1px dashed rgba(255,255,255,0.25)", background: "none", color: "var(--sm-accent)", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                                    >
                                      + Adicionar "{addEngineSearch.trim()}"
                                    </button>
                                  )}
                                  {filteredEngines.length === 0 && !addEngineSearch && (
                                    <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: 0 }}>{t("settings_aiEngine_noneAvailable")}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* CLAUDE — dois jeitos de conectar, aparecem logo abaixo do combobox assim que ele é escolhido.
                              Conectar por assinatura é assíncrono (abre o navegador, espera autorização), então o
                              modal NÃO fecha sozinho ao clicar — fica aberto mostrando o status até a pessoa
                              autorizar (ou desistir e fechar/voltar manualmente). */}
                          {addEngineSelection?.kind === "claude" && claudeAddMethod === null && claudeCliStatus === "connected" && (
                            // Já conectou — nada mais a fazer aqui. Um botão de "Concluir" bem claro em vez de
                            // deixar a pessoa ter que adivinhar que "Voltar" ou clicar fora fecha a janela.
                            <div style={{ marginBottom: "16px" }}>
                              <p style={{ fontSize: "12px", color: "#86efac", margin: "0 0 12px 0" }}>
                                ✅ {claudeCliVersionInfo ? `${claudeCliVersionInfo} — ${t("claude_connectedLabel")}` : t("claude_connectedLabel")} {t("claude_readyToUse")}
                              </p>
                              {/* Debug temporário: não mostra o token inteiro (é uma credencial), só o
                                  suficiente pra confirmar visualmente se ele tem cara de completo (o token
                                  de verdade começa com "sk-ant-oat" e passa de 100 caracteres — se aparecer
                                  bem menor que isso aqui, é sinal de que veio cortado). */}
                              <p style={{ fontSize: "10px", color: "var(--sm-muted)", margin: "0 0 12px 0", fontFamily: "monospace" }}>
                                Token: {claudeOAuthToken ? `${claudeOAuthToken.slice(0, 14)}…${claudeOAuthToken.slice(-4)} (${claudeOAuthToken.length} caracteres)` : "(vazio)"}
                              </p>
                              <button
                                type="button"
                                onClick={closeModal}
                                style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, var(--sm-accent) 0%, var(--sm-accent-deep) 100%)", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                              >
                                Concluir
                              </button>
                            </div>
                          )}

                          {addEngineSelection?.kind === "claude" && claudeAddMethod === null && claudeCliStatus !== "connected" && (
                            <div style={{ marginBottom: "16px" }}>
                              <button
                                type="button"
                                onClick={handleConnectClaudeSubscription}
                                disabled={claudeCliStatus === "connecting" || claudeCliStatus === "checking"}
                                style={{ width: "100%", boxSizing: "border-box", textAlign: "left", padding: "12px 14px", marginBottom: "10px", borderRadius: "8px", border: "none", background: claudeCliStatus === "connecting" || claudeCliStatus === "checking" ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, var(--sm-accent) 0%, var(--sm-accent-deep) 100%)", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: claudeCliStatus === "connecting" || claudeCliStatus === "checking" ? "default" : "pointer" }}
                              >
                                {claudeCliStatus === "connecting" ? t("claude_connectingButton") : t("claude_connectButton")}
                              </button>

                              {claudeCliStatus === "connecting" && (
                                <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 10px 0" }}>
                                  {t("claude_connecting_hint")}{" "}
                                  <button type="button" onClick={handleDisconnectClaudeSubscription} style={{ padding: 0, background: "none", border: "none", color: "var(--sm-accent)", fontSize: "11px", textDecoration: "underline", cursor: "pointer" }}>{t("report_cancel")}</button>
                                </p>
                              )}
                              {claudeCliStatus === "not_found" && (
                                <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 10px 0" }}>
                                  {t("claude_notFound_hint")} <code style={{ background: "rgba(0,0,0,0.3)", padding: "4px 4px", borderRadius: "4px" }}>npm install -g @anthropic-ai/claude-code</code>
                                </p>
                              )}
                              {claudeCliStatus === "not_connected" && (
                                <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 10px 0" }}>
                                  {t("claude_failed_hint")}
                                </p>
                              )}
                              {(claudeCliStatus === "not_found" || claudeCliStatus === "not_connected") && claudeCliDebugMessage && (
                                <pre style={{ fontSize: "10px", color: "var(--sm-muted)", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px", margin: "0 0 10px 0", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "120px", overflowY: "auto" }}>
                                  {claudeCliDebugMessage}
                                </pre>
                              )}

                              <button
                                type="button"
                                onClick={() => setClaudeAddMethod("apikey")}
                                style={{ width: "100%", boxSizing: "border-box", textAlign: "left", padding: "12px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                              >
                                🔑 Usar chave de API
                              </button>
                            </div>
                          )}

                          {addEngineSelection?.kind === "claude" && claudeAddMethod === "apikey" && (
                            <div style={{ marginBottom: "16px" }}>
                              <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 8px 0" }}>
                                {t("claude_apiKey_hint")}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleOpenProviderConsole("https://console.anthropic.com/settings/keys")}
                                style={{ padding: "8px 8px", marginBottom: "10px", background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", color: "var(--sm-accent)", fontSize: "11px", cursor: "pointer" }}
                              >
                                🔗 Obter chave de API
                              </button>
                              <input
                                type="password"
                                placeholder="sk-ant-..."
                                value={draftClaudeApiKey}
                                onChange={(e) => setDraftClaudeApiKey(e.target.value)}
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", ...glassInputStyle }}
                              />
                            </div>
                          )}

                          {/* OUTRO MOTOR — formulário genérico, já vem com nome e URL pré-preenchidos quando
                              o motor escolhido é um dos conhecidos (OpenAI, Gemini, OpenRouter, LM Studio) */}
                          {addEngineSelection?.kind === "custom" && (
                            <div style={{ marginBottom: "16px" }}>
                              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                                <button type="button" onClick={() => handleOpenProviderConsole("https://platform.openai.com/api-keys")} style={{ padding: "8px 8px", background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", color: "var(--sm-accent)", fontSize: "11px", cursor: "pointer" }}>🔗 Chave OpenAI</button>
                                <button type="button" onClick={() => handleOpenProviderConsole("https://aistudio.google.com/apikey")} style={{ padding: "8px 8px", background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", color: "var(--sm-accent)", fontSize: "11px", cursor: "pointer" }}>🔗 Chave Google AI Studio</button>
                              </div>
                              <label style={{ display: "block", fontSize: "10px", color: "var(--sm-muted)", marginBottom: "4px" }}>URL base da API (link)</label>
                              <input
                                type="text"
                                placeholder={t("customProvider_url_placeholder")}
                                value={draftCustomProviderBaseUrl}
                                onChange={(e) => setDraftCustomProviderBaseUrl(e.target.value)}
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", marginBottom: "8px", ...glassInputStyle }}
                              />
                              <label style={{ display: "block", fontSize: "10px", color: "var(--sm-muted)", marginBottom: "4px" }}>{t("customProvider_model_label")}</label>
                              <input
                                type="text"
                                placeholder={t("customProvider_model_placeholder")}
                                value={draftCustomProviderModel}
                                onChange={(e) => setDraftCustomProviderModel(e.target.value)}
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", marginBottom: "8px", ...glassInputStyle }}
                              />
                              <label style={{ display: "block", fontSize: "10px", color: "var(--sm-muted)", marginBottom: "4px" }}>Chave de API (opcional para servidores locais)</label>
                              <input
                                type="password"
                                placeholder="sk-..."
                                value={draftCustomProviderApiKey}
                                onChange={(e) => setDraftCustomProviderApiKey(e.target.value)}
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", ...glassInputStyle }}
                              />
                            </div>
                          )}

                          {/* OLLAMA — local e gratuito, só precisa confirmar (ou trocar) o endereço. Aparece
                              na lista igual aos outros motores, em vez de já entrar e fechar sozinho. */}
                          {addEngineSelection?.kind === "ollama" && (
                            <div style={{ marginBottom: "16px" }}>
                              <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 8px 0" }}>
                                {t("ollama_desc")}
                              </p>
                              <label style={{ display: "block", fontSize: "10px", color: "var(--sm-muted)", marginBottom: "4px" }}>{t("ollama_endpoint_label")}</label>
                              <input
                                type="text"
                                value={draftOllamaEndpoint}
                                onChange={(e) => setDraftOllamaEndpoint(e.target.value)}
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", ...glassInputStyle }}
                              />
                            </div>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <button type="button" onClick={handleFooterBack} style={{ padding: "8px 0", background: "none", border: "none", color: "var(--sm-muted)", fontSize: "12px", cursor: "pointer" }}>
                              {addEngineSelection ? "← Voltar" : "Cancelar"}
                            </button>
                            {isSaveVisible && (
                              <button
                                type="button"
                                disabled={!isSaveEnabled}
                                onClick={handleSaveEngine}
                                style={{ padding: "8px 14px", background: isSaveEnabled ? "linear-gradient(135deg, var(--sm-accent) 0%, var(--sm-accent-deep) 100%)" : "rgba(255,255,255,0.08)", border: "none", borderRadius: "6px", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: isSaveEnabled ? "pointer" : "default" }}
                              >
                                Salvar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* BOTÃO SALVAR — logo abaixo do cartão de configurações, aparece sempre que houver alteração pendente */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={!hasUnsavedSettingsChanges && !settingsSavedFeedback}
                style={{
                  padding: "8px 24px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: "none",
                  cursor: hasUnsavedSettingsChanges ? "pointer" : "default",
                  color: "#fff",
                  background: settingsSavedFeedback
                    ? "linear-gradient(135deg, #22c55e 0%, #15803d 100%)"
                    : hasUnsavedSettingsChanges
                    ? "linear-gradient(135deg, var(--sm-accent) 0%, var(--sm-accent-deep) 100%)"
                    : "rgba(255,255,255,0.08)",
                  boxShadow: hasUnsavedSettingsChanges ? "0 4px 18px rgba(var(--sm-accent-rgb), 0.5)" : "none",
                  opacity: hasUnsavedSettingsChanges || settingsSavedFeedback ? 1 : 0.5,
                  transition: "all 0.2s ease"
                }}
              >
                {settingsSavedFeedback ? t("settings_save_done") : hasUnsavedSettingsChanges ? t("settings_save_pending") : t("settings_save_idle")}
              </button>
            </div>
          </div>
          </div>
        )}

        {/* EDITOR / COMPOSER CHAT */}
        {currentView === "editor" && (
          <>
            {/* ABAS */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", backgroundColor: "rgba(0, 0, 0, 0.1)", paddingLeft: "16px" }}>
              {["chat", "artefatos"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "8px 24px",
                    backgroundColor: activeTab === tab ? "rgba(255, 255, 255, 0.08)" : "transparent",
                    color: activeTab === tab ? "var(--sm-highlight)" : "var(--sm-muted)",
                    border: "none",
                    borderBottom: activeTab === tab ? "2px solid var(--sm-accent)" : "2px solid transparent",
                    cursor: "pointer",
                    textTransform: "capitalize",
                    fontWeight: "600",
                    fontSize: "12px"
                  }}
                >
                  {tab === "chat" ? "💬 Composer" : "📄 Artefatos"}
                </button>
              ))}
            </div>

            {/* CHAT AREA */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100vh - 40px)", overflow: "hidden" }}>
              {activeTab === "chat" && (
                <div style={{ flex: 1, display: "flex", height: "100%", overflow: "hidden" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", maxWidth: activeProject.prd ? "none" : "840px", width: "100%", margin: activeProject.prd ? "0" : "0 auto", padding: "0 16px 16px 16px", boxSizing: "border-box" }}>

                  {/* MENSAGENS */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "24px 0", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {messages.length === 0 ? (
                      <div style={{ margin: "auto", color: "var(--sm-muted)", textAlign: "center", fontSize: "13px" }}>
                        <div style={{ fontSize: "36px", marginBottom: "8px" }}>✦</div>
                        {t(selectedMethod === "BMAD" ? "chat_empty_bmad" : "chat_empty_superpowers")}
                      </div>
                    ) : (
                      messages.map((msg, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                            maxWidth: "85%",
                            width: "100%"
                          }}
                        >
                          <div style={{ fontSize: "11px", color: "var(--sm-accent)", marginBottom: "4px", display: "flex", gap: "8px", alignItems: "center" }}>
                            <span>{msg.sender === "user" ? t("chat_sender_you") : (msg.agentName || selectedAgent.name)}</span>
                          </div>

                          <div
                            style={{
                              padding: "16px 16px",
                              borderRadius: "14px",
                              fontSize: "13px",
                              lineHeight: "1.6",
                              whiteSpace: "pre-wrap",
                              background: msg.sender === "user" ? "linear-gradient(135deg, rgba(var(--sm-accent-strong-rgb), 0.4) 0%, rgba(var(--sm-secondary-rgb), 0.4) 100%)" : "rgba(255, 255, 255, 0.06)",
                              border: msg.sender === "user" ? "1px solid rgba(var(--sm-accent-rgb), 0.3)" : "1px solid rgba(255, 255, 255, 0.1)",
                              backdropFilter: "blur(10px)",
                              color: "#f3e8ff"
                            }}
                          >
                            {msg.text}
                          </div>

                          {msg.sender === "agent" && (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <button
                                onClick={() => handleCopyMessage(msg.text, i)}
                                title={t("tooltip_copyResponse")}
                                style={{
                                  alignSelf: "flex-start",
                                  marginTop: "8px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "none",
                                  border: "none",
                                  padding: "4px 4px",
                                  color: copiedMessageIndex === i ? "#86efac" : "var(--sm-muted)",
                                  fontSize: "11px",
                                  cursor: "pointer"
                                }}
                              >
                                {copiedMessageIndex === i ? "✅ Copiado" : "📋 Copiar"}
                              </button>

                              {/* Fallback manual: usa esta resposta como PRD mesmo que o agente não
                                  tenha perguntado sozinho (o modelo local nem sempre obedece essa parte) */}
                              {!msg.prdDraft && (
                                <button
                                  onClick={() => handleMarkAsPrd(i)}
                                  title={t("tooltip_useAsPrd")}
                                  style={{
                                    alignSelf: "flex-start",
                                    marginTop: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    background: "none",
                                    border: "none",
                                    padding: "4px 4px",
                                    color: "var(--sm-muted)",
                                    fontSize: "11px",
                                    cursor: "pointer"
                                  }}
                                >
                                  📌 Usar como PRD
                                </button>
                              )}
                            </div>
                          )}

                          {/* Quando esta resposta trouxe uma versão pronta do PRD, o usuário decide
                              aqui se atualiza o artefato atual ou gera uma nova versão (vira "Atual",
                              e a versão anterior passa pro Histórico) */}
                          {msg.prdDraft && !msg.prdDraft.resolved && (
                            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                              <button
                                onClick={() => handlePrdDecision(i, "update")}
                                style={{
                                  background: "rgba(255, 255, 255, 0.08)",
                                  color: "var(--sm-highlight)",
                                  border: "1px solid rgba(255, 255, 255, 0.15)",
                                  borderRadius: "8px",
                                  padding: "8px 16px",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  cursor: "pointer"
                                }}
                              >
                                🔄 Atualizar PRD atual
                              </button>
                              <button
                                onClick={() => handlePrdDecision(i, "new")}
                                style={{
                                  background: "linear-gradient(135deg, var(--sm-accent) 0%, var(--sm-accent-deep) 100%)",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: "8px",
                                  padding: "8px 16px",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  cursor: "pointer"
                                }}
                              >
                                {t("prd_generate_new_version")}
                              </button>
                            </div>
                          )}
                          {msg.prdDraft && msg.prdDraft.resolved && (
                            <span style={{ marginTop: "8px", fontSize: "11px", color: "#86efac" }}>
                              {msg.prdDraft.resolution === "update" ? t("prd_updated_current") : t("prd_new_version_saved")}
                            </span>
                          )}
                        </div>
                      ))
                    )}

                    {/* INDICADOR "DIGITANDO..." enquanto o agente está processando a resposta */}
                    {isAgentTyping && (
                      <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-start", maxWidth: "85%" }}>
                        <div style={{ fontSize: "11px", color: "var(--sm-accent)", marginBottom: "4px", display: "flex", gap: "8px", alignItems: "center" }}>
                          <span>{selectedAgent.name}</span>
                        </div>
                        <div
                          style={{
                            padding: "16px 16px",
                            borderRadius: "14px",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            backdropFilter: "blur(10px)",
                            display: "flex",
                            gap: "4px",
                            alignItems: "center"
                          }}
                        >
                          <span className="studio-method-typing-dot"></span>
                          <span className="studio-method-typing-dot"></span>
                          <span className="studio-method-typing-dot"></span>
                        </div>
                      </div>
                    )}

                    {/* Âncora invisível usada para rolar o chat até o fim */}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* CAIXA DE ENTRADA GLASS */}
                  <div
                    ref={composerBoxRef}
                    onDragOver={handleComposerDragOver}
                    onDragLeave={handleComposerDragLeave}
                    onDrop={handleComposerDrop}
                    style={{
                      position: "relative",
                      borderRadius: "16px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      ...glassCardStyle,
                      outline: isDraggingFileOverComposer ? "2px dashed var(--sm-accent)" : "none",
                      outlineOffset: "-2px"
                    }}
                  >
                    {isDraggingFileOverComposer && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: "16px",
                          background: "rgba(139, 92, 246, 0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "var(--sm-accent)",
                          pointerEvents: "none",
                          zIndex: 30
                        }}
                      >
                        📎 Solte o arquivo aqui para anexar
                      </div>
                    )}
                    
                    {/* ARQUIVOS ANEXADOS */}
                    {attachedFiles.length > 0 && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {attachedFiles.map((file, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.15)", padding: "4px 8px", borderRadius: "8px", fontSize: "11px", color: "var(--sm-pale)" }}>
                            <span>{file.type && file.type.startsWith("image/") ? "🖼️" : "📄"} {file.name}</span>
                            <button onClick={() => handleRemoveFile(idx)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", padding: "0 4px" }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* MENU DE AGENTES / */}
                    {showMentionMenu && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "100%",
                          left: 0,
                          right: 0,
                          marginBottom: "8px",
                          borderRadius: "12px",
                          maxHeight: "180px",
                          overflowY: "auto",
                          zIndex: 20,
                          background: "var(--sm-menu-bg)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          boxShadow: "0 12px 32px 0 rgba(0, 0, 0, 0.6)"
                        }}
                      >
                        {filteredAgents.map((agent, agentIndex) => (
                          <div
                            key={agent.id}
                            onClick={() => handleSelectAgentCommand(agent)}
                            onMouseEnter={() => setHighlightedAgentIndex(agentIndex)}
                            style={{
                              padding: "8px 16px",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                              backgroundColor: agentIndex === highlightedAgentIndex ? "rgba(255, 255, 255, 0.1)" : "var(--sm-menu-bg)"
                            }}
                          >
                            <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--sm-soft)" }}>{agent.command}</span>
                            <span style={{ fontSize: "11px", color: "#cbd5e1" }}>{agent.name} • {agent.role}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* INPUT COM PLACEHOLDER DINÂMICO — textarea pra permitir múltiplas linhas
                        (Enter envia, Shift+Enter quebra linha), com altura que cresce sozinha */}
                    <textarea
                      ref={composerTextareaRef}
                      rows={1}
                      placeholder={
                        selectedMethod === "BMAD"
                          ? t("composer_placeholder_bmad")
                          : t("composer_placeholder_superpowers")
                      }
                      value={inputMessage}
                      onChange={handleInputChange}
                      onKeyDown={handleComposerKeyDown}
                      onPaste={handleComposerPaste}
                      style={{
                        width: "100%",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#fff",
                        outline: "none",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                        resize: "none",
                        maxHeight: "160px",
                        overflowY: "auto"
                      }}
                    />

                    {/* CONTROLES INFERIORES */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: "none" }} multiple />
                        <button onClick={() => fileInputRef.current?.click()} style={{ background: "none", border: "none", color: "var(--sm-accent)", fontSize: "15px", cursor: "pointer" }} title={t("tooltip_attachFile")}>
                          📎
                        </button>

                        <select
                          value={selectedMethod}
                          onChange={(e) => setSelectedMethod(e.target.value)}
                          style={{ backgroundColor: "rgba(0,0,0,0.3)", color: "var(--sm-pale)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "4px 8px", fontSize: "11px" }}
                        >
                          <option value="BMAD">BMad Method v6</option>
                          <option value="Superpowers">Superpowers Workflow</option>
                        </select>

                        <select
                          value={selectedEngine}
                          onChange={(e) => setSelectedEngine(e.target.value)}
                          title={t("ai_models_settings_title")}
                          style={{ backgroundColor: "rgba(0,0,0,0.3)", color: "var(--sm-pale)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "4px 8px", fontSize: "11px" }}
                        >
                          <option value="Ollama (Local)">Ollama</option>
                          {claudeCliStatus === "connected" && <option value="Claude (Assinatura)">Claude (sua assinatura)</option>}
                          {claudeApiKey && <option value="Claude (Anthropic)">Claude (API)</option>}
                          {customProviderName && customProviderBaseUrl && (
                            <option value={customProviderName}>{customProviderName}</option>
                          )}
                        </select>
                      </div>

                      <button
                        onClick={handleSendMessage}
                        disabled={isAgentTyping}
                        style={{
                          background: isAgentTyping ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, var(--sm-accent) 0%, var(--sm-accent-deep) 100%)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 16px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: isAgentTyping ? "not-allowed" : "pointer",
                          boxShadow: isAgentTyping ? "none" : "0 2px 10px rgba(var(--sm-accent-rgb), 0.4)"
                        }}
                      >
                        {isAgentTyping ? "Pensando..." : "Enviar ↵"}
                      </button>
                    </div>

                  </div>
                </div>

                {/* PAINEL DO PRD — aparece ao lado do chat quando o projeto tem um PRD carregado
                    (importado de outra pessoa, ou já gerado por um agente neste projeto), pra que
                    o usuário possa ler o documento enquanto conversa com os agentes sobre ele */}
                {activeProject.prd && (
                  <div
                    style={{
                      width: "420px",
                      flexShrink: 0,
                      height: "100%",
                      overflowY: "auto",
                      borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
                      background: "rgba(0, 0, 0, 0.15)",
                      padding: "24px",
                      boxSizing: "border-box"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "16px" }}>
                      <h3 style={{ margin: 0, fontSize: "14px", color: "#fff", fontWeight: "600" }}>📄 {activeProject.prd.title || "PRD"}</h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        {activeProject.importedFrom && (
                          <span style={{ fontSize: "10px", color: "var(--sm-muted)", whiteSpace: "nowrap" }}>de {activeProject.importedFrom}</span>
                        )}
                        <button
                          onClick={() => handleDownloadArtifact({ name: `${sanitizeFolderName(activeProject.prd.title || "PRD")}.md`, content: activeProject.prd.content })}
                          title={t("tooltip_downloadPrd")}
                          style={{
                            background: "rgba(255, 255, 255, 0.08)",
                            color: "var(--sm-highlight)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            borderRadius: "8px",
                            padding: "4px 8px",
                            fontSize: "11px",
                            cursor: "pointer",
                            whiteSpace: "nowrap"
                          }}
                        >
                          ⬇️
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--sm-muted)", margin: "0 0 16px 0" }}>
                      {t("prd_panel_hint")}
                    </p>
                    <div
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        ...glassCardStyle
                      }}
                    >
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontFamily: "inherit",
                          fontSize: "12px",
                          lineHeight: "1.7",
                          color: "#e2d9f3",
                          margin: 0
                        }}
                      >
                        {activeProject.prd.content}
                      </pre>
                    </div>
                  </div>
                )}
                </div>
              )}

              {activeTab === "artefatos" && (
                <div style={{ padding: "32px", color: "var(--sm-pale)", fontSize: "13px", maxWidth: "640px" }}>
                  <h3 style={{ color: "#fff", fontSize: "16px", margin: "0 0 16px 0" }}>{t("artifacts_tab_title")}</h3>
                  {activeProject.artifacts && activeProject.artifacts.length > 0 ? (
                    (() => {
                      const sortedArtifacts = sortArtifactsByDateDesc(activeProject.artifacts);
                      const [currentArtifact, ...historyArtifacts] = sortedArtifacts;

                      const renderArtifactRow = (art, idx, highlighted) => (
                        <li
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "16px",
                            padding: highlighted ? "14px 16px" : "10px 14px",
                            borderRadius: "10px",
                            ...glassCardStyle,
                            border: highlighted ? "1px solid var(--sm-accent)" : "1px solid rgba(255,255,255,0.1)"
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span>📄 {art.name}</span>
                            <span style={{ fontSize: "10px", color: "var(--sm-muted)" }}>criado em: {formatArtifactDate(art)}</span>
                          </div>
                          <button
                            onClick={() => handleDownloadArtifact(art)}
                            title={t("artifact_download_title")}
                            style={{
                              background: "rgba(255, 255, 255, 0.08)",
                              color: "var(--sm-highlight)",
                              border: "1px solid rgba(255, 255, 255, 0.15)",
                              borderRadius: "8px",
                              padding: "4px 8px",
                              fontSize: "11px",
                              cursor: "pointer",
                              whiteSpace: "nowrap"
                            }}
                          >
                            ⬇️ Baixar
                          </button>
                        </li>
                      );

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                          <div>
                            <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--sm-accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("artifacts_current_label")}</span>
                            <ul style={{ paddingLeft: 0, listStyle: "none", margin: "8px 0 0 0" }}>
                              {renderArtifactRow(currentArtifact, "current", true)}
                            </ul>
                          </div>

                          {historyArtifacts.length > 0 && (
                            <div>
                              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "16px" }}>
                                <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--sm-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("history_label")}</span>
                                <ul style={{ paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", margin: "8px 0 0 0" }}>
                                  {historyArtifacts.map((art, idx) => renderArtifactRow(art, idx, false))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <p>Nenhum artefato gerado para este projeto.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODAL NOVO PROJETO */}
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "380px", ...glassCardStyle }}>
            <h2 style={{ marginTop: 0, fontSize: "16px", color: "#fff" }}>{t("new_project_modal_title")}</h2>
            <form onSubmit={handleConfirmCreateProject} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
              <input
                type="text"
                placeholder={t("new_project_title_placeholder")}
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                style={{ width: "100%", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", ...glassInputStyle }}
                autoFocus
              />
              <textarea
                placeholder={t("new_project_desc_placeholder")}
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                style={{ width: "100%", padding: "8px 16px", borderRadius: "8px", height: "60px", fontSize: "12px", resize: "none", boxSizing: "border-box", ...glassInputStyle }}
              />

              <div style={{ fontSize: "11px", color: "var(--sm-muted)", lineHeight: "1.5" }}>
                {workspaceRoot
                  ? <>{t("new_project_will_save_at")} <strong style={{ color: "var(--sm-pale)" }}>{workspaceRoot}/{sanitizeFolderName(newProjectTitle || "novo-projeto")}</strong></>
                  : t("new_project_askFolder_hint")}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: "8px 16px", backgroundColor: "transparent", color: "var(--sm-accent)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", fontSize: "12px", cursor: "pointer" }}>{t("report_cancel")}</button>
                <button
                  type="submit"
                  disabled={!newProjectTitle.trim()}
                  style={{ padding: "8px 16px", background: newProjectTitle.trim() ? "linear-gradient(135deg, var(--sm-accent) 0%, var(--sm-accent-deep) 100%)" : "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: newProjectTitle.trim() ? "pointer" : "not-allowed" }}
                >
                  {t("button_create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR PROJETO */}
      {isDeleteModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "360px", ...glassCardStyle }}>
            <h2 style={{ marginTop: 0, fontSize: "16px", color: "#fca5a5" }}>{t("delete_modal_title")}</h2>
            <p style={{ fontSize: "13px", color: "var(--sm-pale)", margin: "8px 0 16px 0" }}>
              {t("delete_modal_confirm")} <strong>"{projectToDelete?.title}"</strong>?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => setIsDeleteModalOpen(false)} style={{ padding: "8px 16px", backgroundColor: "transparent", color: "var(--sm-accent)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", fontSize: "12px", cursor: "pointer" }}>{t("delete_modal_cancel")}</button>
              <button type="button" onClick={handleConfirmDeleteProject} style={{ padding: "8px 16px", backgroundColor: "#dc2626", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>{t("delete_modal_delete")}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RELATAR UM PROBLEMA */}
      {isReportModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "420px", ...glassCardStyle }}>
            <h2 style={{ marginTop: 0, fontSize: "16px", color: "#fff" }}>{t("report_modalTitle")}</h2>

            <label style={{ display: "block", fontSize: "11px", color: "var(--sm-accent)", margin: "16px 0 6px 0" }}>{t("report_categoryLabel")}</label>
            <select
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value)}
              style={{ width: "100%", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", ...glassInputStyle }}
            >
              <option value="">{t("report_categoryPlaceholder")}</option>
              {REPORT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat[language] || cat.pt}</option>
              ))}
            </select>

            <label style={{ display: "block", fontSize: "11px", color: "var(--sm-accent)", margin: "16px 0 6px 0" }}>{t("report_descriptionLabel")}</label>
            <textarea
              rows={5}
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder={t("report_descriptionPlaceholder")}
              style={{ width: "100%", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", ...glassInputStyle }}
            />

            {reportFeedback === "success" && (
              <p style={{ fontSize: "12px", color: "#86efac", marginTop: "12px", marginBottom: 0 }}>{t("report_success")}</p>
            )}
            {reportFeedback === "error" && (
              <p style={{ fontSize: "12px", color: "#fca5a5", marginTop: "12px", marginBottom: 0 }}>{t("report_error")}</p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button type="button" onClick={() => setIsReportModalOpen(false)} style={{ padding: "8px 16px", backgroundColor: "transparent", color: "var(--sm-accent)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", fontSize: "12px", cursor: "pointer" }}>
                {t("report_cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={!reportCategory || !reportDescription.trim() || reportSubmitting}
                style={{
                  padding: "8px 16px",
                  backgroundColor: !reportCategory || !reportDescription.trim() ? "rgba(255,255,255,0.08)" : "var(--sm-accent-strong)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: !reportCategory || !reportDescription.trim() || reportSubmitting ? "default" : "pointer",
                  opacity: !reportCategory || !reportDescription.trim() ? 0.6 : 1
                }}
              >
                {reportSubmitting ? t("report_submitting") : t("report_submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TOUR DE BOAS-VINDAS (ONBOARDING) */}
      {isOnboardingOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "440px", ...glassCardStyle }}>
            <h2 style={{ marginTop: 0, marginBottom: "4px", fontSize: "17px", color: "#fff" }}>{t("onboarding_title")}</h2>

            <div style={{ display: "flex", gap: "6px", margin: "12px 0 20px 0" }}>
              {[0, 1, 2, 3].map((stepIndex) => (
                <div
                  key={stepIndex}
                  style={{
                    flex: 1, height: "4px", borderRadius: "2px",
                    backgroundColor: stepIndex <= onboardingStep ? "var(--sm-accent)" : "rgba(255, 255, 255, 0.12)"
                  }}
                />
              ))}
            </div>

            <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "var(--sm-highlight)" }}>
              {t(`onboarding_step${onboardingStep + 1}_title`)}
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--sm-pale)", lineHeight: "1.6", whiteSpace: "pre-line" }}>
              {t(`onboarding_step${onboardingStep + 1}_body`)}
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
              <button
                type="button"
                onClick={handleCloseOnboarding}
                style={{ padding: "8px 12px", backgroundColor: "transparent", color: "var(--sm-muted)", border: "none", fontSize: "12px", cursor: "pointer" }}
              >
                {t("onboarding_skip")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onboardingStep < 3) {
                    setOnboardingStep(onboardingStep + 1);
                  } else {
                    handleCloseOnboarding();
                  }
                }}
                style={{ padding: "8px 20px", backgroundColor: "var(--sm-accent)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
              >
                {onboardingStep < 3 ? t("onboarding_next") : t("onboarding_start")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AVISO DE ATUALIZAÇÃO DISPONÍVEL — aparece sozinho ao abrir o app quando existe
          uma versão nova (e a pessoa ainda não adiou essa mesma versão). "Não" só adia (some
          por enquanto, mas continua disponível em Configurações); "Sim" baixa, instala e
          reabre o app já atualizado. */}
      {isUpdateDialogOpen && updateInfo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 210 }}>
          <div style={{ padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "400px", ...glassCardStyle }}>
            {updateInstallStatus === "downloading" || updateInstallStatus === "installing" ? (
              <>
                <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "17px", color: "#fff" }}>{t("update_installing_title")}</h2>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--sm-pale)", lineHeight: "1.6" }}>{t("update_installing_body")}</p>
              </>
            ) : (
              <>
                <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "17px", color: "#fff" }}>{t("update_dialog_title")}</h2>
                <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "var(--sm-pale)", lineHeight: "1.6" }}>{t("update_dialog_body")}</p>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--sm-muted)" }}>v{updateInfo.version}</p>

                {updateInstallStatus === "error" && (
                  <p style={{ fontSize: "11px", color: "#fca5a5", margin: "12px 0 0 0" }}>{t("update_install_error")}</p>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
                  <button
                    type="button"
                    onClick={handleDismissUpdateDialog}
                    style={{ padding: "8px 20px", backgroundColor: "transparent", color: "var(--sm-muted)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", fontSize: "12px", cursor: "pointer" }}
                  >
                    {t("update_dialog_no")}
                  </button>
                  <button
                    type="button"
                    onClick={handleInstallUpdate}
                    style={{ padding: "8px 20px", backgroundColor: "var(--sm-accent)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                  >
                    {t("update_dialog_yes")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
