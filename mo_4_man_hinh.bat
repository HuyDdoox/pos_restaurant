@echo off
title MO 4 MAN HINH POS RESTAURANT
echo ========================================================
echo   DANG MO 4 CUA SO TRINH DUYET THUC TE TREN MAN HINH
echo ========================================================

set CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe

if exist "%CHROME%" (
    echo [1/4] Mo Khach hang (Ban 1)...
    start "" "%CHROME%" --user-data-dir="%TEMP%\pos_customer" --new-window "http://localhost:3000/views/customer/index.html?table=1"

    echo [2/4] Mo Phuc vu (Waiter)...
    start "" "%CHROME%" --user-data-dir="%TEMP%\pos_waiter" --new-window "http://localhost:3000/views/staff/waiter.html"

    echo [3/4] Mo Nha bep (Kitchen KDS)...
    start "" "%CHROME%" --user-data-dir="%TEMP%\pos_kitchen" --new-window "http://localhost:3000/views/staff/kitchen.html"

    echo [4/4] Mo Thu ngan (Cashier)...
    start "" "%CHROME%" --user-data-dir="%TEMP%\pos_cashier" --new-window "http://localhost:3000/views/staff/cashier.html"
) else (
    echo Dung trinh duyet Microsoft Edge...
    start msedge --user-data-dir="%TEMP%\pos_customer" --new-window "http://localhost:3000/views/customer/index.html?table=1"
    start msedge --user-data-dir="%TEMP%\pos_waiter" --new-window "http://localhost:3000/views/staff/waiter.html"
    start msedge --user-data-dir="%TEMP%\pos_kitchen" --new-window "http://localhost:3000/views/staff/kitchen.html"
    start msedge --user-data-dir="%TEMP%\pos_cashier" --new-window "http://localhost:3000/views/staff/cashier.html"
)

echo.
echo ========================================================
echo   DA MO XONG 4 CUA SO! BAN CO THE BEO VA TEST NGAY.
echo ========================================================
timeout /t 3 >nul
