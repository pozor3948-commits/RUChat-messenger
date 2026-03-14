# ⚙️ Настройка RuChat - Пошаговая инструкция

Время настройки: ~15 минут

---

## 📋 ШАГ 1: Установка зависимостей

```bash
npm install
```

**Установятся:**
- Firebase SDK
- node-telegram-bot-api
- nodemailer
- dotenv
- И другие зависимости

---

## 🔑 ШАГ 2: Получение Telegram токена

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Введите имя бота (например: `RuChat Assistant`)
4. Введите username бота (например: `RuChatAssistantBot`)
5. **Сохраните полученный токен** (выглядит как: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

---

## 🔐 ШАГ 3: Создание Firebase проекта

1. Откройте [Firebase Console](https://console.firebase.google.com/)
2. Нажмите **"Add project"**
3. Введите название (например: `RuChat`)
4. Отключите Google Analytics (не обязательно)
5. Нажмите **"Create project"**

### Включите Realtime Database:

1. В меню слева выберите **"Build"** → **"Realtime Database"**
2. Нажмите **"Create database"**
3. Выберите локацию (Europe или US)
4. Выберите **"Start in test mode"** (потом изменим правила)
5. Нажмите **"Enable"**

### Скопируйте URL базы данных:

1. В Realtime Database нажмите на иконку **"⋮"** (три точки)
2. Выберите **"Project settings"**
3. Найдите **"Database URL"**
4. **Скопируйте URL** (выглядит как: `https://your-project-default-rtdb.europe-west1.firebasedatabase.app`)

---

## 📝 ШАГ 4: Настройка конфигурации

### 4.1 Создайте файл .env

```bash
cp .env.example .env
```

### 4.2 Откройте .env и заполните:

```env
# Telegram Bot (из Шага 2)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Код разработчика (придумайте свой, минимум 6 символов)
DEV_CODE=MySecretCode123

# Email для уведомлений (опционально)
ADMIN_EMAIL=ruchat.official@mail.ru

# Firebase URL (из Шага 3)
FIREBASE_DB_URL=https://your-project-default-rtdb.europe-west1.firebasedatabase.app

# SMTP (опционально, для email уведомлений)
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_USER=your_email@mail.ru
SMTP_PASS=your_app_password
```

**Важно:**
- `DEV_CODE` - это код для доступа к функциям разработчика в боте
- `SMTP_PASS` - это пароль приложения, не от почты!

---

## 🚀 ШАГ 5: Развертывание правил Firebase

### 5.1 Войдите в Firebase CLI

```bash
firebase login
```

### 5.2 Инициализируйте проект

```bash
firebase init
```

Выберите:
- **Database** (Realtime Database)
- **Functions** (Cloud Functions)

### 5.3 Разверните правила

```bash
firebase deploy --only database
```

### 5.4 Разверните Cloud Functions

```bash
firebase deploy --only functions
```

---

## 🌐 ШАГ 6: Запуск приложения

### Вариант A: Firebase Hosting (рекомендуется)

```bash
firebase serve
```

Откройте: `http://localhost:5000`

### Вариант B: Простой HTTP сервер

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx http-server -p 8000
```

Откройте: `http://localhost:8000`

### Вариант C: Просто открыть файл

⚠️ **Не все функции будут работать!**

PWA и некоторые функции требуют HTTP/HTTPS.

---

## 🤖 ШАГ 7: Запуск бота

```bash
node bot.js
```

**Проверьте вывод:**
```
✅ Бот авторизован: @YourBotName
✅ RuChat Admin Bot запущен!
📧 Email для жалоб: ruchat.official@mail.ru
🔗 Firebase URL: https://...
```

**Если ошибка:**
- ❌ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен → Проверьте `.env`
- ❌ ОШИБКА: Неверный токен бота → Проверьте токен в `.env`

---

## 📱 ШАГ 8: Проверка работы

### 8.1 Откройте приложение в браузере

1. Откройте `http://localhost:5000` (или другой порт)
2. Нажмите **"Зарегистрироваться"**
3. Введите имя (минимум 3 символа)
4. Введите пароль (минимум 6 символов)
5. Нажмите **"Создать аккаунт"**

### 8.2 Проверьте Firebase

1. Откройте [Firebase Console](https://console.firebase.google.com/)
2. Выберите ваш проект
3. Перейдите в **"Realtime Database"**
4. Вы должны увидеть нового пользователя в `/accounts/username`

### 8.3 Проверьте бота

1. Откройте Telegram
2. Найдите вашего бота
3. Нажмите `/start`
4. Нажмите **"🔐 Войти как разработчик"**
5. Введите `DEV_CODE` из `.env`

---

## 🔧 УСТРАНЕНИЕ ПРОБЛЕМ

### Ошибка: "Пользователь уже существует"

**Решение:** Используйте другое имя или удалите пользователя из Firebase.

### Ошибка: "Сервер не отвечает"

**Причины:**
- Нет интернета
- Firebase проект не создан
- Неверный `FIREBASE_DB_URL`

**Решение:**
1. Проверьте интернет
2. Проверьте URL в `.env`
3. Проверьте правила Firebase (должны быть `.read: true`)

### Бот не запускается

**Причины:**
- Не установлен `.env`
- Неверный токен
- Не установлены зависимости

**Решение:**
```bash
npm install
# Проверьте .env файл
node bot.js
```

### PWA не работает

**Причина:** PWA требует HTTP/HTTPS, не работает через `file://`

**Решение:** Используйте `firebase serve` или другой HTTP сервер.

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

### Для разработки:

1. Изучите структуру проекта
2. Внесите изменения в код
3. Протестируйте локально
4. Разверните изменения

### Для продакшена:

1. ⚠️ Включите Firebase Authentication
2. ⚠️ Обновите правила безопасности
3. ⚠️ Настройте HTTPS
4. ⚠️ Используйте свои TURN серверы

См. **SECURITY_REPORT.md** для деталей.

---

## 📚 ДОПОЛНИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ

- **README.md** - Общая информация
- **CHANGELOG.md** - История изменений
- **SECURITY_REPORT.md** - Отчет о безопасности
- **functions/index.js** - Документация Cloud Functions

---

## ❓ Вопросы?

- **Email:** ruchat.official@mail.ru
- **Telegram:** @RuChatBot
