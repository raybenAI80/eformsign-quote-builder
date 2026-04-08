<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1KCM7SBU1KoOemd31LSJmpJx_dD-WqGfI

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Agent Orchestrator

This repo includes a tracked `agent-orchestrator.yaml` baseline and a Windows-to-WSL launcher at [`scripts/ao-wsl.ps1`](/c:/eformsign-견적서-빌더/scripts/ao-wsl.ps1).

WSL setup and daily operation:
- [`docs/agent-orchestrator-wsl.md`](/c:/eformsign-견적서-빌더/docs/agent-orchestrator-wsl.md)
