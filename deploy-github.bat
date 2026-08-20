@echo off

echo ==========================================
echo  ChargeFlow - Deploy para GitHub
echo ==========================================
echo.
cd /d C:/Users/g7gam/Documents/kimi/workspace/chargeflow
echo.
echo Passo 1: Limpando repositorio antigo...
rmdir /s /q .git 2>nul
echo.
echo Passo 2: Configurando Git do zero...
git init
git config user.email "chargeflow@deploy.local"
git config user.name "ChargeFlow Deploy"
git remote remove origin 2>nul
git remote add origin https://github.com/SlowICE3235/chargeflow.git
echo.
echo Passo 3: Adicionando arquivos (ignorando node_modules)...
git add .
echo.
echo Passo 4: Criando commit...
git commit -m "Primeiro deploy ChargeFlow"
echo.
echo Passo 5: Subindo para o GitHub...
git branch -M main
git push -u origin main
echo.
echo ==========================================
echo PRONTO! Agora volte na Vercel e clique Deploy.
echo ==========================================
pause
