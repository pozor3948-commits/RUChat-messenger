/* ==========================================================
   3. РЈРўРР›РРўР« Р”Р›РЇ Р›РћРљРђР›Р¬РќРћР™ Р РђР—Р РђР‘РћРўРљР
   ========================================================== */

// Р“Р›РћР‘РђР›Р¬РќР«Р• РџР•Р Р•РњР•РќРќР«Р•
let notificationQueue = [];
let isNotificationShowing = false;
let isMobile = window.innerWidth <= 768;
let userStatuses = {};

// Р¤СѓРЅРєС†РёСЏ РїСЂРѕРІРµСЂРєРё СЃРѕРµРґРёРЅРµРЅРёСЏ
function checkConnection() {
    if (!navigator.onLine) { 
        showError('РќРµС‚ СЃРѕРµРґРёРЅРµРЅРёСЏ СЃ РёРЅС‚РµСЂРЅРµС‚РѕРј'); 
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

// Р¤СѓРЅРєС†РёСЏ СѓРІРµРґРѕРјР»РµРЅРёР№ С‡РµСЂРµР· РіР»РѕР±Р°Р»СЊРЅСѓСЋ
function showNotification(title, text, type = 'info') {
    if (typeof window.showNotification === 'function') {
        window.showNotification(title, text, type);
    } else {
        // Fallback РґР»СЏ СЃС‚Р°СЂС‹С… РІС‹Р·РѕРІРѕРІ
        notificationQueue.push({ title, text });
        if (!isNotificationShowing) showNextNotification();
    }

    // Пытаемся показать системное уведомление (браузер)
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

// Р¤СѓРЅРєС†РёСЏ РѕС€РёР±РѕРє С‡РµСЂРµР· РіР»РѕР±Р°Р»СЊРЅСѓСЋ
function showError(msg, retry) {
    if (typeof window.showError === 'function') {
        window.showError(msg, retry);
    } else {
        // Fallback РґР»СЏ СЃС‚Р°СЂС‹С… РІС‹Р·РѕРІРѕРІ
        const err = document.createElement('div');
        err.className = 'error-message';
        err.innerHTML = `<span>${msg}</span>${retry ? '<button class="error-retry" onclick="retryAction()">РџРѕРІС‚РѕСЂРёС‚СЊ</button>' : ''}`;
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

