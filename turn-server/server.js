// Простой TURN сервер для тестирования
// ВНИМАНИЕ: Это упрощенная версия, для продакшена используйте coturn

const turn = require('node-turn');

const PORT = process.env.PORT || 3478;
const REALM = process.env.REALM || 'ruchat-turn';
const USERNAME = process.env.USERNAME || 'test';
const PASSWORD = process.env.PASSWORD || 'test';

const server = turn({
    realm: REALM,
    port: PORT,
    auth: {
        credentials: {
            [USERNAME]: PASSWORD
        }
    },
    log: (level, message) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${level}: ${message}`);
    }
});

server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('TURN сервер запущен!');
    console.log(`Порт: ${PORT}`);
    console.log(`Realm: ${REALM}`);
    console.log(`User: ${USERNAME}`);
    console.log(`Pass: ${PASSWORD}`);
    console.log('='.repeat(50));
    console.log('Для ngrok выполните: ngrok tcp ' + PORT);
    console.log('='.repeat(50));
});

server.on('error', (err) => {
    console.error('Ошибка TURN сервера:', err);
});
