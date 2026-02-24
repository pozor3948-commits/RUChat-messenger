/* ==========================================================
   3. УТИЛИТЫ ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ
   ========================================================== */

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let notificationQueue = [];
let isNotificationShowing = false;
let isMobile = window.innerWidth <= 768;
let userStatuses = {};
window._ruchatBootAt = window._ruchatBootAt || Date.now();

// Кэш для fixMojibakeCp1251
const mojibakeCache = new Map();

function fixMojibakeCp1251(str) {
    if (!str) return str;
    if (typeof str !== 'string') return str;
    
    // Проверяем кэш
    if (mojibakeCache.has(str)) {
        return mojibakeCache.get(str);
    }
    
    // Быстрая проверка: если строка короткая и содержит только обычные символы, пропускаем
    if (str.length < 100 && /^[\u0400-\u04FF\s\p{P}\p{S}\p{N}\p{L}]*$/u.test(str)) {
        mojibakeCache.set(str, str);
        return str;
    }
    
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c >= 0x0410 && c <= 0x044F) {
            bytes.push(c - 0x0410 + 0xC0);
            continue;
        }
        if (c === 0x0401) { bytes.push(0xA8); continue; }
        if (c === 0x0451) { bytes.push(0xB8); continue; }
        if (c >= 0x0402 && c <= 0x040F) {
            bytes.push(c - 0x0402 + 0x80);
            continue;
        }
        if (c >= 0x0452 && c <= 0x045F) {
            bytes.push(c - 0x0452 + 0x90);
            continue;
        }
        if (c <= 0x00FF) {
            bytes.push(c);
            continue;
        }
        // Сохраняем оригинальный символ
        bytes.push(c);
    }
    
    let result;
    try {
        result = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch {
        result = str;
    }
    
    // Кэшируем результат
    mojibakeCache.set(str, result);
    return result;
}

// Кэш для normalizeText
const normalizeCache = new Map();

function normalizeText(text) {
    if (typeof text !== 'string') return text === null || text === undefined ? '' : text;
    if (!text) return text;
    
    // Проверяем кэш
    if (normalizeCache.has(text)) {
        return normalizeCache.get(text);
    }
    
    // Быстрая проверка для коротких строк без mojibake
    if (text.length < 50 && /^[\u0400-\u04FF\s\p{P}\p{S}\p{N}\p{L}\n\t]*$/u.test(text)) {
        const trimmed = text.trim();
        normalizeCache.set(text, trimmed);
        return trimmed;
    }
    
    const vowels = /[аеёиоуыэюя]/gi;
    const countVowels = (str) => (str.match(vowels) || []).length;
    const countRS = (str) => (str.match(/[РС]/g) || []).length;
    const score = (str) => countVowels(str) - countRS(str) * 0.5;

    const fixed = fixMojibakeCp1251(text);
    if (fixed && fixed !== text) {
        if (score(fixed) >= score(text) + 1 || countRS(fixed) < countRS(text)) {
            const trimmed = fixed.trim();
            normalizeCache.set(text, trimmed);
            return trimmed;
        }
    }

    const fixedTwice = fixMojibakeCp1251(fixed);
    if (fixedTwice && fixedTwice !== text) {
        if (score(fixedTwice) >= score(text) + 1 || countRS(fixedTwice) < countRS(text)) {
            const trimmed = fixedTwice.trim();
            normalizeCache.set(text, trimmed);
            return trimmed;
        }
    }

    const trimmed = text.trim();
    normalizeCache.set(text, trimmed);
    return trimmed;
}

function isValidMediaUrl(url) {
    return typeof url === 'string' && (
        url.startsWith('data:') ||
        url.startsWith('http://') ||
        url.startsWith('https://') ||
        url.startsWith('blob:')
    );
}

function fixMojibakeValue(value) {
    if (typeof value !== 'string') return value;
    if (!/[А-Яа-яЁё]/.test(value)) return value;
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    const fixed = normalizeText(value);
    return fixed;
}

const MOJIBAKE_SKIP_KEYS = new Set([
    'from',
    'createdBy',
    'username',
    'password',
    'avatar',
    'photo',
    'video',
    'audio',
    'document',
    'chatBg'
]);

async function runMojibakeMigration() {
    const database = window.db || (typeof db !== 'undefined' ? db : null);
    if (!database) { showError('База не инициализирована'); return; }
    if (window._mojibakeMigrationRunning) return;
    const confirmText = 'Это изменит данные в базе и исправит иероглифы. Продолжить?';
    if (!confirm(confirmText)) return;
    window._mojibakeMigrationRunning = true;

    const roots = ['accounts', 'groups', 'privateChats', 'groupChats'];
    const updates = [];

    const collect = (node, path, keyName) => {
        if (typeof node === 'string') {
            if (keyName && MOJIBAKE_SKIP_KEYS.has(keyName)) return;
            const fixed = fixMojibakeValue(node);
            if (fixed !== node) updates.push([path, fixed]);
            return;
        }
        if (!node || typeof node !== 'object') return;
        Object.keys(node).forEach(k => {
            collect(node[k], `${path}/${k}`, k);
        });
    };

    try {
        showNotification('Миграция', 'Сканирую базу...', 'info');
        for (const root of roots) {
            const snap = await database.ref(root).get();
            if (snap.exists()) collect(snap.val(), root, null);
        }

        if (!updates.length) {
            showNotification('Миграция', 'Исправлений не найдено', 'info');
            return;
        }

        const batchSize = 200;
        let applied = 0;
        for (let i = 0; i < updates.length; i += batchSize) {
            const batch = {};
            updates.slice(i, i + batchSize).forEach(([path, value]) => {
                batch[path] = value;
            });
            await database.ref().update(batch);
            applied += Object.keys(batch).length;
            showNotification('Миграция', `Обновлено ${applied} полей`, 'info');
        }
        showNotification('Миграция', 'Готово. Перезагрузите страницу.', 'success');
    } catch (e) {
        console.error(e);
        showError('Ошибка миграции базы');
    } finally {
        window._mojibakeMigrationRunning = false;
    }
}

window.runMojibakeMigration = runMojibakeMigration;

const EPHEMERAL_TTLS = [0];
const EPHEMERAL_LABELS = ['Off'];
let currentEphemeralIndex = 0;

function getEphemeralExpiresAt() {
    const ttl = EPHEMERAL_TTLS[currentEphemeralIndex] || 0;
    return ttl > 0 ? Date.now() + ttl : null;
}

function updateEphemeralUi() {
    const btn = document.getElementById('ttlBtn');
    if (!btn) return;
    const ttl = EPHEMERAL_TTLS[currentEphemeralIndex] || 0;
    btn.dataset.ttl = EPHEMERAL_LABELS[currentEphemeralIndex] || 'Off';
    btn.classList.toggle('active', ttl > 0);
}

function cycleEphemeralTtl() {
    currentEphemeralIndex = (currentEphemeralIndex + 1) % EPHEMERAL_TTLS.length;
    localStorage.setItem('ruchat_ttl_index', String(currentEphemeralIndex));
    updateEphemeralUi();
}

document.addEventListener('DOMContentLoaded', () => {
    const saved = parseInt(localStorage.getItem('ruchat_ttl_index') || '0', 10);
    if (!Number.isNaN(saved) && saved >= 0 && saved < EPHEMERAL_TTLS.length) {
        currentEphemeralIndex = saved;
    }
    updateEphemeralUi();

    // Мониторим реальное соединение с Firebase (важно для Android WebView,
    // где navigator.onLine часто показывает "онлайн", даже когда RTDB не подключён).
    try {
        if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
            window.firebaseConnected = null;
            db.ref('.info/connected').on('value', s => {
                window.firebaseConnected = (s.val() === true);
            });
        }
    } catch {
        // ignore
    }
});

// Функция проверки соединения
function checkConnection() {
    if (!navigator.onLine) { 
        showError('Нет соединения с интернетом'); 
        return false; 
    }
    // Если уже известно, что Firebase не подключён — не ждём таймаутов и не "крутим" загрузку.
    if (window.firebaseConnected === false) {
        const sinceBoot = Date.now() - (window._ruchatBootAt || Date.now());
        if (sinceBoot < 5000) {
            showError('Подключаюсь к серверу… попробуйте ещё раз через пару секунд');
        } else {
            showError('Нет соединения с сервером (Firebase)');
        }
        return false;
    }
    // isOnline выставляется в status.js через /.info/connected
    try {
        if (typeof isOnline !== 'undefined' && isOnline === false) {
            showError('Нет соединения с сервером');
            return false;
        }
    } catch {
        // ignore
    }
    return true;
}

// Обёртка: быстро падаем по таймауту, чтобы не висеть на "загрузке" 20-60 секунд.
function withTimeout(promise, ms, errorMessage = 'Истекло время ожидания') {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
    ]);
}

window.withTimeout = withTimeout;

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(normalizeText(text) || '');
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    const k = 1024, sizes = ['Bytes','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Функция уведомлений - внутренняя реализация
function showNotificationInternal(title, text, type = 'info') {
    // Не используем normalizeText для избежания рекурсии при загрузке
    const safeTitle = title ? String(title).slice(0, 200) : '';
    const safeText = text ? String(text).slice(0, 500) : '';
    
    const n = document.getElementById('notification');
    if (!n) {
        // Fallback если элемент уведомления не найден
        notificationQueue.push({ title: safeTitle, text: safeText });
        if (!isNotificationShowing) showNextNotification();
        return;
    }

    document.getElementById('notificationTitle').textContent = safeTitle;
    document.getElementById('notificationText').textContent = safeText;

    // Устанавливаем тип уведомления
    n.className = 'notification';
    if (type === 'error') {
        n.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.95), rgba(220,38,38,0.95))';
        n.style.boxShadow = '0 15px 35px rgba(239,68,68,0.4), 0 5px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
    } else if (type === 'success') {
        n.style.background = 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(74,222,128,0.95))';
        n.style.boxShadow = '0 15px 35px rgba(34,197,94,0.4), 0 5px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
    } else if (type === 'warning') {
        n.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.95), rgba(217,119,6,0.95))';
        n.style.boxShadow = '0 15px 35px rgba(245,158,11,0.4), 0 5px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
    }

    n.style.display = 'flex';

    // Автоматическое скрытие
    setTimeout(() => {
        n.style.display = 'none';
        // Сбрасываем стили
        n.style.background = '';
        n.style.boxShadow = '';
    }, 3000);
}

// Публичная функция уведомлений
function showNotification(title, text, type = 'info') {
    // Используем внутреннюю реализацию напрямую
    showNotificationInternal(title, text, type);
}

function isSystemNotificationsEnabled() {
    return localStorage.getItem('systemNotifications') !== 'false';
}

function isNotifyOnlyHidden() {
    return localStorage.getItem('notifyOnlyHidden') !== 'false';
}

async function requestSystemNotifications() {
    if (!('Notification' in window)) {
        showNotificationInternal('Уведомления', 'Не поддерживаются в этом браузере', 'warning');
        return 'unsupported';
    }
    try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            localStorage.setItem('systemNotifications', 'true');
            showNotificationInternal('Уведомления', 'Разрешение получено', 'success');
        } else {
            showNotificationInternal('Уведомления', 'Разрешение не получено', 'warning');
        }
        return perm;
    } catch (e) {
        showNotificationInternal('Не удалось запросить разрешение', 'Ошибка', 'error');
        return 'error';
    }
}

function maybeShowSystemNotification(title, body, options = {}) {
    if (!isSystemNotificationsEnabled()) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (isNotifyOnlyHidden() && document.hasFocus()) return;
    try {
        const n = new Notification(title, {
            body: body || '',
            icon: options.icon || undefined,
            tag: options.tag || undefined,
            silent: options.silent || false
        });
        if (!options.silent && typeof navigator !== 'undefined' && navigator.vibrate && isMobile) {
            navigator.vibrate(150);
        }
        return n;
    } catch (e) {
        // ignore
    }
}

window.requestSystemNotifications = requestSystemNotifications;
window.maybeShowSystemNotification = maybeShowSystemNotification;

// Функция ошибок - внутренняя реализация
function showErrorInternal(msg, retry) {
    // Не используем normalizeText для избежания рекурсии
    const safeMsg = msg ? String(msg).slice(0, 500) : 'Ошибка';
    showNotificationInternal(safeMsg, retry ? 'Нажмите повторить' : '', 'error');
    if (retry) window.retryAction = retry;
}

// Публичная функция ошибок
function showError(msg, retry) {
    // Используем внутреннюю реализацию напрямую
    showErrorInternal(msg, retry);
}

function showNextNotification() {
    if (!notificationQueue.length) { isNotificationShowing = false; return; }
    isNotificationShowing = true;
    const { title, text } = notificationQueue.shift();
    const n = document.getElementById('notification');
    if (n) {
        document.getElementById('notificationTitle').textContent = title;
        document.getElementById('notificationText').textContent = text;
        n.style.display = 'flex';
        setTimeout(() => { n.style.display = 'none'; setTimeout(showNextNotification, 300); }, 3000);
    }
}


