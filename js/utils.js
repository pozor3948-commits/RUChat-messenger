/* ==========================================================
   3. УТИЛИТЫ ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ
   ========================================================== */

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let notificationQueue = [];
let isNotificationShowing = false;
let isMobile = window.innerWidth <= 768;
let userStatuses = {};

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
    div.textContent = text;
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
