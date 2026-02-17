/* ==========================================================
   4. СТАТУСЫ ПОЛЬЗОВАТЕЛЕЙ (ИСПОЛЬЗУЕМ ГЛОБАЛЬНУЮ userStatuses)
   ========================================================== */
function getFriendStatusText(st) {
    if (!st) return "Был(а) недавно";
    if (st.online === true) return st.idle ? "Неактивен" : "В сети";
    return "Был(а) недавно";
}

function getFriendStatusClass(st) {
    if (!st) return "recently";
    if (st.online === true) return st.idle ? "idle" : "online";
    return "recently";
}

function getOnlineDotClass(st) {
    if (!st) return "online-dot recently";
    if (st.online === true) return st.idle ? "online-dot idle" : "online-dot";
    return "online-dot recently";
}

function canShowLastSeen(friendName) {
    const cache = window.friendPrivacyCache || {};
    const rule = cache[friendName] || 'everyone';
    if (rule === 'nobody') return false;
    return true;
}

function updateFriendStatusInList(friendName, statusData) {
    // Используем глобальную переменную userStatuses из utils.js
    userStatuses[friendName] = statusData;
    const onlineDot = document.getElementById(`online_${friendName}`);
    const lastSeenElement = document.getElementById(`lastSeen_${friendName}`);
    const visible = canShowLastSeen(friendName);
    if (onlineDot) onlineDot.className = getOnlineDotClass(statusData);
    if (lastSeenElement) {
        if (visible) {
            lastSeenElement.textContent = getFriendStatusText(statusData);
            lastSeenElement.className = `last-seen ${getFriendStatusClass(statusData)}`;
        } else {
            lastSeenElement.textContent = "Скрыт(а)";
            lastSeenElement.className = "last-seen recently";
        }
    }
    if (currentChatPartner === friendName && !isGroupChat) updateChatStatus(friendName, statusData);
}

function updateChatStatus(friendName, statusData) {
    const chatMembersElement = document.getElementById("chatMembers");
    const mobileChatStatus = document.getElementById("mobileChatStatus");
    if (chatMembersElement && mobileChatStatus) {
        const statusText = canShowLastSeen(friendName) ? getFriendStatusText(statusData) : "Скрыт(а)";
        const statusClass = getFriendStatusClass(statusData);
        chatMembersElement.textContent = statusText;
        chatMembersElement.className = `chat-members ${statusClass}`;
        mobileChatStatus.textContent = statusText;
    }
}

function updateMyStatus(isOnlineStatus, isIdle = false) {
    if (!username) return;
    const statusData = { online: isOnlineStatus, idle: isIdle, lastSeen: Date.now(), username: username };
    db.ref(`userStatus/${username}`).set(statusData);
    db.ref(`accounts/${username}`).update({ lastSeen: statusData.lastSeen, online: isOnlineStatus });
    
    // Используем глобальную переменную userStatuses
    userStatuses[username] = statusData;
    
    const myStatusElement = document.getElementById('userStatus');
    if (myStatusElement) {
        if (isOnlineStatus) {
            myStatusElement.textContent = isIdle ? "Неактивен" : "В сети";
            myStatusElement.className = isIdle ? "user-status idle" : "user-status";
        } else {
            myStatusElement.textContent = "Был(а) недавно";
            myStatusElement.className = "user-status recently";
        }
    }
}

function setupActivityTracking() {
    let idleTimer = null;
    const idleTimeout = 30000;
    function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        if (userStatuses[username]?.idle === true) updateMyStatus(true, false);
        idleTimer = setTimeout(() => updateMyStatus(true, true), idleTimeout);
    }
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(ev => document.addEventListener(ev, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) updateMyStatus(true, true); else { updateMyStatus(true, false); resetIdleTimer(); }
    });
    if (activityCheckInterval) clearInterval(activityCheckInterval);
    activityCheckInterval = setInterval(() => updateMyStatus(true, false), 60000);
}

function setupUserStatusMonitoring() {
    db.ref("userStatus").on("value", s => {
        if (!s.exists()) return;
        s.forEach(ch => updateFriendStatusInList(ch.key, ch.val()));
    });
}

function setupNetworkMonitoring() {
    // navigator.onLine / offline-events часто "врут" в Android WebView.
    // Для чата важнее реальное соединение с Firebase RTDB: /.info/connected
    let last = null;
    let offlineTimer = null;

    const setConnected = (connected) => {
        const next = !!connected;
        if (last === next) return;
        last = next;

        if (offlineTimer) {
            clearTimeout(offlineTimer);
            offlineTimer = null;
        }

        if (next) {
            isOnline = true;
            updateMyStatus(true, false);
            showNotification("Сеть", "Соединение восстановлено", "success");
            if (typeof flushPendingQueue === 'function') flushPendingQueue();
            return;
        }

        // Небольшая задержка, чтобы не показывать "Нет сети" из‑за кратких просадок.
        offlineTimer = setTimeout(() => {
            isOnline = false;
            updateMyStatus(false, false);
            showNotification("Сеть", "Нет соединения. Отправка будет в очереди", "warning");
        }, 1200);
    };

    try {
        if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
            db.ref(".info/connected").on("value", s => setConnected(s.val() === true));
        }
    } catch {
        // ignore
    }

    window.addEventListener('online', () => setConnected(true));
    window.addEventListener('offline', () => setConnected(false));
}
