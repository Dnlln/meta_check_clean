@echo off
title MetaCheck & Cleaner Windows 11
echo Launching MetaCheck & Cleaner...
cd /d "%~dp0"
start http://localhost:3000
npm run dev
pause
