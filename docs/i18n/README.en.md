<p align="center">
  <img src="../../src-tauri/icons/128x128.png" width="96" alt="Studio Method" />
</p>

<h1 align="center">Studio Method</h1>

<p align="center">
  <a href="../../README.md">Português (BR)</a> ·
  <a href="README.en.md">English</a> ·
  <a href="README.zh-CN.md">中文</a>
</p>

---

Studio Method is a desktop app for macOS and Windows that works as a central hub for advanced AI-assisted work methods, such as Superpowers and BMAD.

## What it is

It organizes and connects the entire production flow of product teams, unifying everything from the initial concept and PRD writing to the final code.

Inside the platform, each team member works on the same project through an interface adapted to their role:

- **PM (Product Manager)**: structures and manages product requirements in standardized PRDs.
- **PD (Product Designer)**: turns the scope into prototypes aligned with the project's guidelines.
- **Dev (Developer)**: receives handoffs already structured and ready for the implementation queue.

The handoff between roles happens continuously inside the app itself. When a stage is marked as complete or ready for the next role, the project automatically moves to the next person's queue.

Throughout the process, integrated AI agents — triggered with a slash command (`/`) — support task execution. They apply the configured methodologies to help write documentation, generate prototypes, and guide the code, ensuring the right level of adherence to the design system and the team's rules.

## Privacy and security

**Your projects and files stay on your computer.** Studio Method does not send your project content (PRDs, prototypes, code, files) to any server — everything is read and saved directly to the folder you choose on your own disk.

The only data that goes through an external server (Supabase) is what's needed for **account login** (email and password, so you can access the app). No project content is stored there.

If you connect an AI model (Claude, a local Ollama server, or another OpenAI-API-compatible provider), the messages you send in chat are shared with that AI provider to generate responses — as happens with any app that uses AI. Without connecting a model, the agents won't work, but the rest of the app works normally.

## How to install

1. Go to this repository's **[Releases](../../../../releases)** tab.
2. Download the installer for your system from the latest version:
   - **Mac**: `.dmg` file
   - **Windows**: `.msi` or `.exe` file
3. Open the installer and follow the steps.

**Operating system security warning:** since the app hasn't gone through the paid digital signing process yet (Apple/Microsoft), macOS and Windows may show a warning saying the developer is unrecognized. This is expected — to open it anyway:
- **Mac**: right-click the app → "Open" → confirm "Open" in the dialog that appears.
- **Windows**: on the blue SmartScreen screen, click "More info" → "Run anyway".

## Getting started after installing

1. Create your account or sign in.
2. Choose your role (PM, PD, or Dev).
3. Go to **Settings → AI Models** and connect a model (recommended: your Claude subscription), so the agents can respond.
4. Start a new project and explore the chat by typing `/`.
