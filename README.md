# 💬 RuChat Мессенджер

Современный веб-мессенджер с поддержкой аудио звонков, групповых чатов и секретных переписок.

![Статус](https://img.shields.io/badge/status-ready-green)
![Версия](https://img.shields.io/badge/version-1.5.0-blue)
![PWA](https://img.shields.io/badge/PWA-supported-orange)

---

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка конфигурации

Скопируйте `.env.example` в `.env` и заполните:

```bash
cp .env.example .env
```

**Обязательные переменные:**
- `TELEGRAM_BOT_TOKEN` - токен Telegram бота (получить у @BotFather)
- `DEV_CODE` - код доступа для разработчика
- `FIREBASE_DB_URL` - URL Firebase Realtime Database

**Опциональные переменные:**
- `ADMIN_EMAIL` - email для жалоб
- `SMTP_*` - настройки SMTP для отправки email

### 3. Запуск

```bash
# Запуск веб-сервера (порт 5000)
firebase serve

# ИЛИ открыть index.html в браузере (не все функции доступны)
```

### 4. Запуск бота

```bash
node bot.js
```

---

## 📁 Структура проекта

```
RUCHATMESSEN/
├── index.html              # Главная страница
├── manifest.json           # PWA манифест
├── bot.js                  # Telegram бот для модерации
├── firebase.json           # Конфигурация Firebase
├── database.rules.json     # Правила безопасности БД
├── .env.example            # Шаблон конфигурации
├── CHANGELOG.md            # История изменений
├── README.md               # Эта документация
├── css/
│   ├── style.css           # Основные стили
│   └── new-features.css    # Стили новых функций
├── js/
│   ├── auth.js             # Аутентификация
│   ├── chat.js             # Логика чатов
│   ├── ui.js               # UI функции
│   ├── audio-call.js       # Аудио звонки WebRTC
│   ├── stories.js          # Истории
│   ├── friends.js          # Друзья
│   ├── groups.js           # Группы
│   ├── crypto.js           # Шифрование
│   └── sounds.js           # Звуки
└── functions/
    └── index.js            # Cloud Functions
```

---

## 🔧 Настройка Firebase

### 1. Создайте проект в [Firebase Console](https://console.firebase.google.com/)

### 2. Включите Realtime Database

### 3. Разверните правила

```bash
firebase deploy --only database
```

### 4. Обновите конфигурацию

В `.env` укажите ваш `FIREBASE_DB_URL`:
```
FIREBASE_DB_URL=https://your-project-default-rtdb.europe-west1.firebasedatabase.app
```

---

## 🤖 Telegram бот

Бот для модерации мессенджера.

### Функции:
- 👥 Просмотр всех пользователей
- 🚫 Управление черным списком
- 💬 Просмотр сообщений
- 📊 Статистика
- 📬 Отправка жалоб на email

### Команды:
- `/start` - Главное меню
- 🔐 Войти как разработчик - Ввод кода доступа
- 👥 Пользователи - Список всех пользователей
- 🚫 Черный список - Заблокированные пользователи
- 📊 Статистика - Статистика мессенджера

---

## 📱 PWA (Progressive Web App)

Мессенджер поддерживает установку как PWA:

### На компьютере:
1. Откройте сайт в Chrome/Edge
2. Нажмите "Установить приложение" в адресной строке

### На телефоне:
1. Откройте сайт в Safari/Chrome
2. "Поделиться" → "На экран «Домой»"

**Требования:**
- HTTPS соединение (или localhost)
- Не работает через `file://`

---

## 🔒 Безопасность

### Текущая реализация:
- ✅ Валидация данных на клиенте и сервере
- ✅ Rate limiting через Cloud Functions
- ✅ XSS защита (экранирование)
- ✅ E2EE для секретных чатов (RSA)

### В планах:
- ⏳ Firebase Auth
- ⏳ Хеширование паролей
- ⏳ Собственные TURN серверы

---

## 🎨 Функции

### Чаты
- ✅ Личные сообщения
- ✅ Групповые чаты
- ✅ Секретные чаты с шифрованием
- ✅ Поиск сообщений
- ✅ История переписки

### Звонки
- ✅ Аудио звонки 1-на-1
- ⏳ Видеозвонки (в планах)
- ⏳ Групповые звонки (в планах)

### Дополнительно
- ✅ Истории (stories)
- ✅ Друзья и заявки
- ✅ Push уведомления
- ✅ Эмодзи и стикеры
- ✅ Голосовые сообщения
- ✅ Отправка файлов

---

## 🛠 Технологии

| Компонент | Технология |
|-----------|------------|
| Frontend | HTML, CSS, JavaScript (Vanilla) |
| Backend | Firebase Realtime Database |
| Cloud Functions | Node.js + Firebase Functions |
| Звонки | WebRTC |
| Бот | Telegram Bot API + node-telegram-bot-api |
| PWA | Service Worker + Manifest |

---

## 📝 Лицензия

MIT

---

## 📞 Контакты

- **Email**: ruchat.official@mail.ru
- **Telegram**: @RuChatBot

---

## 🐛 Сообщить об ошибке

Создайте issue в репозитории или напишите в поддержку.
