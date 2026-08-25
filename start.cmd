@echo off
cd /d "%~dp0"
echo Starting Nube at http://localhost:3000
echo Press Ctrl+C to stop it.
"C:\Users\ale\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" dev
