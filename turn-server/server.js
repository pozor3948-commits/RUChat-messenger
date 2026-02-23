// Простой WebSocket сервер для проверки связи
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('📡 WebSocket сервер запущен на порту 8080');
console.log('Для проверки откройте: http://localhost:8080');

wss.on('connection', (ws) => {
    console.log('✅ Клиент подключён');
    
    ws.on('message', (message) => {
        console.log('Получено:', message.toString());
        ws.send('Эхо: ' + message);
    });
    
    ws.on('close', () => {
        console.log('❌ Клиент отключён');
    });
});
