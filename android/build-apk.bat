@echo off
chcp 65001 >nul
echo ============================================
echo   Сборка RuChat Messenger для Android
echo ============================================
echo.

REM Проверка JAVA_HOME
if "%JAVA_HOME%"=="" (
    echo [ERROR] JAVA_HOME не установлен!
    echo Установите JDK 17 и задайте переменную JAVA_HOME
    echo Например: setx JAVA_HOME "C:\Program Files\Java\jdk-17"
    pause
    exit /b 1
)

echo [INFO] JAVA_HOME: %JAVA_HOME%
echo [INFO] Java version:
java -version
echo.

REM Переход в директорию проекта
cd /d "%~dp0"

REM Проверка наличия Android SDK
if "%ANDROID_HOME%"=="" if "%ANDROID_SDK_ROOT%"=="" (
    echo [WARNING] ANDROID_HOME не установлен
    echo Попытка использования локального gradle...
)

REM Очистка
echo [INFO] Очистка...
call gradlew.bat clean

REM Копирование веб-файлов
echo [INFO] Копирование веб-файлов...
if not exist "app\src\main\assets\www" mkdir "app\src\main\assets\www"
xcopy /E /I /Y "..\index.html" "app\src\main\assets\www\"
xcopy /E /I /Y "..\js" "app\src\main\assets\www\js"
xcopy /E /I /Y "..\css" "app\src\main\assets\www\css"
xcopy /E /I /Y "..\assets" "app\src\main\assets\www\assets"
xcopy /E /I /Y "..\firebase.json" "app\src\main\assets\www\"
xcopy /E /I /Y "..\database.rules.json" "app\src\main\assets\www\"

echo [INFO] Файлы скопированы
echo.

REM Сборка Debug APK
echo [INFO] Сборка debug APK...
call gradlew.bat assembleDebug

if exist "app\build\outputs\apk\debug\app-debug.apk" (
    echo.
    echo ============================================
    echo   СБОРКА УСПЕШНА!
    echo ============================================
    echo APK файл: app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo Для установки на устройство:
    echo   adb install app\build\outputs\apk\debug\app-debug.apk
    echo.
) else (
    echo.
    echo [ERROR] Сборка не удалась!
    echo Проверьте логи выше.
)

pause
