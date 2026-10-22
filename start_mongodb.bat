@echo off
title Khoi dong MongoDB - FoodHub

:: Kiem tra quyen Administrator, neu chua co thi tu dong popup yeu cau quyen (UAC)
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Dang yeu cau quyen Administrator tu Windows...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ====================================================
echo   KHOI DONG DICH VU MONGODB (FOODHUB RESTAURANT)
echo ====================================================
echo.
echo Dang khoi dong dich vu MongoDB...
net start MongoDB
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================================
    echo   [OK] MongoDB da khoi dong thanh cong!
    echo   Backend va Frontend se ket noi ngay lap tuc.
    echo ====================================================
) else (
    echo.
    echo Dịch vụ MongoDB đã được bật hoặc đang hoạt động.
)
echo.
timeout /t 3
exit
