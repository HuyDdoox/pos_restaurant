@echo off
title MO 5 MAN HINH POS RESTAURANT (FULL 5 ROLES)
echo ========================================================
echo   DANG MO FULL 5 CUA SO TRINH DUYET CAC VAI TRO
echo ========================================================

set CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe

if exist "%CHROME%" (
    echo [1/5] Mo Khach hang (Ban 1)...
    start "" "%CHROME%" --user-data-dir="%TEMP%\pos_customer" --new-window "http://localhost:3000/views/customer/index.html?table=1"

    echo [2/5] Mo Phuc vu (Waiter)...
    start "" "%CHROME%" --user-data-dir="%TEMP%\pos_waiter" --new-window "http://localhost:3000/views/staff/waiter.html"

    echo [3/5] Mo Nha bep (Kitchen KDS)...
    start "" "%CHROME%" --user-data-dir="%TEMP%\pos_kitchen" --new-window "http://localhost:3000/views/staff/kitchen.html"

    echo [4/5] Mo Thu ngan (Cashier)...
    start "" "%CHROME%" --user-data-dir="%TEMP%\pos_cashier" --new-window "http://localhost:3000/views/staff/cashier.html"

    echo [5/5] Mo Quan tri vien (Admin)...
    start "" "%CHROME%" --user-data-dir="%TEMP%\pos_admin" --new-window "http://localhost:3000/views/staff/admin.html"
) else (
    echo Dung trinh duyet Microsoft Edge...
    start msedge --user-data-dir="%TEMP%\pos_customer" --new-window "http://localhost:3000/views/customer/index.html?table=1"
    start msedge --user-data-dir="%TEMP%\pos_waiter" --new-window "http://localhost:3000/views/staff/waiter.html"
    start msedge --user-data-dir="%TEMP%\pos_kitchen" --new-window "http://localhost:3000/views/staff/kitchen.html"
    start msedge --user-data-dir="%TEMP%\pos_cashier" --new-window "http://localhost:3000/views/staff/cashier.html"
    start msedge --user-data-dir="%TEMP%\pos_admin" --new-window "http://localhost:3000/views/staff/admin.html"
)

echo.
echo ========================================================
echo   DA MO THANH CONG TOAN BO 5 CUA SO!
echo   Tai khoan: waiter / chef / cashier / admin (pass: 123456)
echo ========================================================
timeout /t 3 >nul
