@echo off
setlocal
echo ==========================================
echo       质粒管理系统 (Streamlit版)
echo ==========================================
echo.

:: 检查是否安装了 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python 环境，请先安装 Python。
    pause
    exit /b
)

:: 检查并安装依赖
echo [1/2] 正在检查依赖环境...
pip show streamlit >nul 2>&1
if %errorlevel% neq 0 (
    echo 正在安装 streamlit 和 pandas (仅首次运行需要)...
    pip install streamlit pandas -i https://pypi.tuna.tsinghua.edu.cn/simple
)

:: 启动应用
echo [2/2] 正在启动管理系统...
echo.
echo 系统启动后会自动在浏览器打开。
echo 如果没有自动打开，请手动访问: http://localhost:8501
echo.
echo (按 Ctrl+C 并输入 Y 可以关闭系统)
echo.

streamlit run plasmid_app.py --global.developmentMode=false --client.toolbarMode=viewer

pause
