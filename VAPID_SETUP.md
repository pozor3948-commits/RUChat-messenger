# 🔔 Настройка Push-уведомлений (VAPID Key)

## Проблема
В логах браузера вы видите сообщение:
```
RuChat push: missing VAPID key. Set window.RUCHAT_WEB_PUSH_VAPID_KEY in js/firebase-config.js.
```

Это означает, что для работы push-уведомлений нужен **Firebase Web Push VAPID ключ**.

## Как получить VAPID ключ

### Шаг 1: Откройте Firebase Console
Перейдите по ссылке: https://console.firebase.google.com/

### Шаг 2: Выберите проект
Выберите ваш проект **RuChat** (или создайте новый).

### Шаг 3: Откройте настройки проекта
1. Нажмите на иконку ⚙️ (Settings) рядом с "Project Overview"
2. Выберите **"Project settings"**

### Шаг 4: Перейдите в Cloud Messaging
1. В верхней части страницы нажмите на вкладку **"Cloud Messaging"**
2. Прокрутите вниз до раздела **"Web Push certificates"**

### Шаг 5: Сгенерируйте ключ
1. Если ключ ещё не создан, нажмите **"Generate key pair"**
2. Скопируйте **VAPID public key** (длинная строка в формате Base64)

### Шаг 6: Вставьте ключ в код
Откройте файл `js/firebase-config.js` и замените значение:

```javascript
window.RUCHAT_WEB_PUSH_VAPID_KEY = 'ВАШ_КОПИРОВАННЫЙ_КЛЮЧ';
```

## Пример
```javascript
// Было (не работает):
window.RUCHAT_WEB_PUSH_VAPID_KEY = 'BKag...'; // ЗАМЕНИТЕ НА ВАШ КЛЮЧ

// Стало (работает):
window.RUCHAT_WEB_PUSH_VAPID_KEY = 'BJLCbG7K3xN9qR8tY2vZ5wA4bC6dE8fG0hI1jK3lM5nO7pQ9rS1tU3vW5xY7zA9...';
```

## Проверка работы
После настройки:
1. Обновите страницу мессенджера
2. В консоли браузера **не должно быть** сообщения `missing VAPID key`
3. При получении сообщения должно приходить push-уведомление

## Примечания
- VAPID ключ **публичный**, его можно хранить в клиентском коде
- Для полной безопасности также настройте **Firebase Security Rules**
- Push-уведомления работают только в **защищённом контексте** (HTTPS или localhost)

## Ссылки
- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging/js-client)
- [Web Push Protocol (RFC 8030)](https://tools.ietf.org/html/rfc8030)
