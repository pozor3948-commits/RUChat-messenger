/* ==========================================================
   3. УТИЛИТЫ ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ
   ========================================================== */

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let notificationQueue = [];
let isNotificationShowing = false;
let isMobile = window.innerWidth <= 768;
let userStatuses = {};

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
    // Heuristic: many 'Р'/'С' patterns indicate CP1251 mojibake
    const suspect = /[РС]/.test(text) && (text.match(/[РС]/g) || []).length >= 3;
    if (!suspect) return text;
    const fixed = fixMojibakeCp1251(text);
    // Accept fix if it contains more typical Cyrillic vowels
    const vowels = /[аеёиоуыэюя]/gi;
    if ((fixed.match(vowels) || []).length >= (text.match(vowels) || []).length) {
        return fixed;
    }
    return text;
}

// Функция проверки соединения
function checkConnection() {
    if (!navigator.onLine) { 
        showError('Нет соединения с интернетом'); 
        return false; 
    }
    return true;
}

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
    if (typeof window.showNotification === 'function') {
        window.showNotification(title, text, type);
    } else {
        // Fallback для старых вызовов
        notificationQueue.push({ title, text });
        if (!isNotificationShowing) showNextNotification();
    }

    // Показываем системные уведомления (fallback)
    try {
        if (document.visibilityState !== 'visible' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(title, { body: text });
            } else if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    } catch (e) {
        // ignore
    }
}

// Функция ошибок через глобальную
function showError(msg, retry) {
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




