// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Quando o app é aberto normalmente (duplo clique, não pelo Terminal), o macOS/Windows
// não carrega o PATH configurado no .zshrc/.bashrc/perfil do usuário — só um PATH mínimo
// do sistema. Isso faz comandos como "claude" (instalado via npm, Homebrew, nvm, etc.) não
// serem encontrados mesmo estando instalados e funcionando normalmente no Terminal.
//
// A primeira versão disso perguntava pro shell de login do usuário qual era o PATH dele —
// só que isso se mostrou instável (às vezes demora, às vezes o shell de login se comporta
// diferente sem um terminal de verdade por trás, e em alguns casos simplesmente não retorna
// nada). Agora a estratégia é em camadas, da mais confiável pra mais completa: primeiro os
// locais fixos onde ferramentas de linha de comando quase sempre ficam (não depende de nada
// externo), depois uma busca nas pastas de versão do nvm (que mudam de máquina pra máquina),
// e só por último — como complemento, com um limite de tempo — a pergunta ao shell de login,
// que cobre qualquer outro lugar não previsto (fnm, asdf, pyenv, etc.). Mesmo se essa última
// parte falhar ou demorar, as duas primeiras já resolvem a grande maioria dos casos.
fn fix_path_env() {
    #[cfg(target_os = "macos")]
    {
        use std::collections::HashSet;
        use std::path::Path;

        let home = std::env::var("HOME").unwrap_or_default();
        let mut dirs: Vec<String> = Vec::new();

        // 1) Locais fixos mais comuns — checagem instantânea, sem depender de nada externo.
        let fixed_candidates = [
            "/opt/homebrew/bin".to_string(),
            "/opt/homebrew/sbin".to_string(),
            "/usr/local/bin".to_string(),
            format!("{}/.local/bin", home),
            format!("{}/.npm-global/bin", home),
            format!("{}/.claude/local", home),
            format!("{}/.volta/bin", home),
            format!("{}/bin", home),
        ];
        for c in fixed_candidates {
            if Path::new(&c).exists() {
                dirs.push(c);
            }
        }

        // 2) nvm instala o node (e os binários globais, tipo "claude") dentro de uma pasta
        // com o número da versão, que varia de máquina pra máquina.
        let nvm_dir = format!("{}/.nvm/versions/node", home);
        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            for entry in entries.flatten() {
                let bin = entry.path().join("bin");
                if bin.exists() {
                    if let Some(s) = bin.to_str() {
                        dirs.push(s.to_string());
                    }
                }
            }
        }

        // 3) Complemento: pergunta pro shell de login do usuário qual é o PATH completo dele,
        // com um limite de tempo curto pra nunca travar a abertura do app.
        if let Some(extra) = get_login_shell_path() {
            for part in extra.split(':') {
                if !part.is_empty() {
                    dirs.push(part.to_string());
                }
            }
        }

        // PATH original do sistema, por último (prioridade menor, mas sempre presente).
        if let Ok(current) = std::env::var("PATH") {
            for part in current.split(':') {
                if !part.is_empty() {
                    dirs.push(part.to_string());
                }
            }
        }

        // Remove duplicados mantendo a ordem (prioriza os locais específicos do usuário).
        let mut seen = HashSet::new();
        let deduped: Vec<String> = dirs.into_iter().filter(|d| seen.insert(d.clone())).collect();
        std::env::set_var("PATH", deduped.join(":"));
    }
}

#[cfg(target_os = "macos")]
fn get_login_shell_path() -> Option<String> {
    use std::sync::mpsc;
    use std::time::Duration;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let marker_start = "___SM_PATH_START___";
        let marker_end = "___SM_PATH_END___";
        let script = format!("echo {}$PATH{}", marker_start, marker_end);
        let result = std::process::Command::new(&shell).arg("-ilc").arg(&script).output();
        let _ = tx.send(result);
    });

    match rx.recv_timeout(Duration::from_secs(3)) {
        Ok(Ok(output)) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let marker_start = "___SM_PATH_START___";
            let marker_end = "___SM_PATH_END___";
            if let (Some(start), Some(end)) = (stdout.find(marker_start), stdout.find(marker_end)) {
                let extracted = stdout[(start + marker_start.len())..end].trim().to_string();
                if !extracted.is_empty() {
                    return Some(extracted);
                }
            }
            None
        }
        // Deu erro, ou passou de 3 segundos sem resposta — segue em frente sem essa parte,
        // já que os locais fixos verificados antes cobrem a grande maioria dos casos.
        _ => None,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    fix_path_env();
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
