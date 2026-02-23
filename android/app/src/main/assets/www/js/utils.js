/* ==========================================================
   3. УТИЛИТЫ ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ
   ========================================================== */

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let notificationQueue = [];
let isNotificationShowing = false;
let isMobile = window.innerWidth <= 768;
let userStatuses = {};
window._ruchatBootAt = window._ruchatBootAt || Date.now();

function fixMojibakeCp1251(str) {
    if (!str) return str;
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
        bytes.push(0x3F);
    }
    try {
        return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch {
        return str;
    }
}

function normalizeText(text) {
    if (typeof text !== 'string') return text;
    const vowels = /[аеёиоуыэюя]/gi;
    const countVowels = (str) => (str.match(vowels) || []).length;
    const countRS = (str) => (str.match(/[РС]/g) || []).length;
    const score = (str) => countVowels(str) - countRS(str) * 0.5;

    const fixed = fixMojibakeCp1251(text);
    if (fixed && fixed !== text) {
        if (score(fixed) >= score(text) + 1 || countRS(fixed) < countRS(text)) {
            return fixed;
        }
    }

    const fixedTwice = fixMojibakeCp1251(fixed);
    if (fixedTwice && fixedTwice !== text) {
        if (score(fixedTwice) >= score(text) + 1 || countRS(fixedTwice) < countRS(text)) {
            return fixedTwice;
        }
    }

    return text;
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
    const div = document.createElement('div');
    div.textContent = normalizeText(text);
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

// Функция уведомлений через глобальную
function showNotification(title, text, type = 'info') {
    title = normalizeText(title);
    text = normalizeText(text);
    if (typeof window.showNotification === 'function') {
        window.showNotification(title, text, type);
    } else {
        // Fallback для старых вызовов
        notificationQueue.push({ title, text });
        if (!isNotificationShowing) showNextNotification();
    }
}

function isSystemNotificationsEnabled() {
    return localStorage.getItem('systemNotifications') !== 'false';
}

function isNotifyOnlyHidden() {
    return localStorage.getItem('notifyOnlyHidden') !== 'false';
}

async function requestSystemNotifications() {
    if (!('Notification' in window)) {
        showError('Уведомления не поддерживаются в этом браузере');
        return 'unsupported';
    }
    try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            localStorage.setItem('systemNotifications', 'true');
            showNotification('Уведомления', 'Разрешение получено', 'success');
        } else {
            showNotification('Уведомления', 'Разрешение не получено', 'warning');
        }
        return perm;
    } catch (e) {
        showError('Не удалось запросить разрешение');
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

// Функция ошибок через глобальную
function showError(msg, retry) {
    msg = normalizeText(msg);
    if (typeof window.showError === 'function') {
        window.showError(msg, retry);
    } else {
        // Fallback для старых вызовов
        const err = document.createElement('div');
        err.className = 'error-message';
        err.innerHTML = `<span>${msg}</span>${retry ? '<button class="error-retry" onclick="retryAction()">Повторить</button>' : ''}`;
        document.body.appendChild(err);
        if (retry) window.retryAction = retry;
        setTimeout(() => { err.remove(); window.retryAction = null; }, 5000);
    }
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


