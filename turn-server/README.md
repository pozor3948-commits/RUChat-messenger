# Простой TURN сервер для RuChat

## Установка

```bash
cd turn-server
npm install
```

## Запуск

```bash
npm start
```

Или с параметрами:

```bash
PORT=3478 USERNAME=test PASSWORD=test npm start
```

## Запуск с ngrok

1. Запустите TURN сервер:
   ```bash
   npm start
   ```

2. В другом терминале запустите ngrok:
   ```bash
   ngrok tcp 3478
   ```

3. Скопируйте адрес из ngrok (например: `0.tcp.ngrok.io:12345`)

4. Обновите `js/audio-call.js`:
   ```javascript
   {
       urls: 'turn:0.tcp.ngrok.io:12345',
       username: 'test',
       credential: 'test'
   }
   ```

## Важно!

- Это тестовый сервер, НЕ для продакшена
- Для продакшена используйте **coturn**
- ngrok бесплатной версии меняет адрес при каждом запуске
- Для стабильной работы нужен статический IP

## Альтернатива: coturn

```bash
docker run --net=host -p 3478:3478 -p 3478:3478/tcp \
  coturn/coturn -n --log-file=stdout \
  --server-name=turn --realm=turn \
  --listening-port=3478 --listening-ip=0.0.0.0 \
  --user=test:test --lt-cred-mech \
  --no-multicast-peers --no-loopback-peers
```
