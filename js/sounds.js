/* ==========================================================
   ЗВУКОВЫЕ ЭФФЕКТЫ (УЛУЧШЕННАЯ ВЕРСИЯ)
   ========================================================== */

// Создание AudioContext
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Генерация звука отправки сообщения
function generateSendSound() {
    const duration = 0.15;
    const now = audioContext.currentTime;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(1200, now + duration);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
}

// Генерация звука получения сообщения
function generateReceiveSound() {
    const duration = 0.1;
    const now = audioContext.currentTime;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.exponentialRampToValueAtTime(300, now + duration);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.25, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
}

// Генерация звука уведомления
function generateNotificationSound() {
    const playTone = (frequency, startTime, duration) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.2, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    };
    
    const now = audioContext.currentTime;
    playTone(800, now, 0.1);
    playTone(1000, now + 0.15, 0.1);
}

// Публичные функции
function playSendSound() {
    try {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        generateSendSound();
    } catch (error) {
        console.error('Ошибка звука:', error);
    }
}

function playReceiveSound() {
    try {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        generateReceiveSound();
    } catch (error) {
        console.error('Ошибка звука:', error);
    }
}

function playNotificationSound() {
    try {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        generateNotificationSound();
    } catch (error) {
        console.error('Ошибка звука:', error);
    }
}

// Экспорт
if (typeof window !== 'undefined') {
    window.playSendSound = playSendSound;
    window.playReceiveSound = playReceiveSound;
    window.playNotificationSound = playNotificationSound;
}

console.log('✅ Звуки загружены');
