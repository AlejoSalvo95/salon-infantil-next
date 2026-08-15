@echo off
cd /d "%~dp0"
echo Iniciando Nube en http://localhost:3000
echo Para detenerla, presiona Ctrl+C.
"C:\Users\ale\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" dev
