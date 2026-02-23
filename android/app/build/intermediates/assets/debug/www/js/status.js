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

let networkConnectedRef = null;
let networkConnectedHandler = null;
let browserOnlineHandler = null;
let browserOfflineHandler = null;

function getServerTimestampValue() {
    try {
        if (
            typeof firebase !== 'undefined' &&
            firebase &&
            firebase.database &&
            firebase.database.ServerValue &&
            firebase.database.ServerValue.TIMESTAMP
        ) {
            return firebase.database.ServerValue.TIMESTAMP;
        }
    } catch {
        // ignore
    }
    return Date.now();
}

function buildMyStatusPayload(isOnlineStatus, isIdle = false) {
    const online = isOnlineStatus === true;
    return {
        online,
        idle: online && isIdle === true,
        lastSeen: getServerTimestampValue(),
        username: username
    };
}

function setupPresenceDisconnectHook() {
    if (!username) return;
    if (typeof db === 'undefined' || !db || typeof db.ref !== 'function') return;

    const offlineStatus = {
        online: false,
        idle: false,
        lastSeen: getServerTimestampValue(),
        username: username
    };

    try { db.ref(`userStatus/${username}`).onDisconnect().update(offlineStatus); } catch {}
    try { db.ref(`accounts/${username}`).onDisconnect().update({ online: false, lastSeen: getServerTimestampValue() }); } catch {}
}
window.setupPresenceDisconnectHook = setupPresenceDisconnectHook;

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

    const statusData = buildMyStatusPayload(isOnlineStatus, isIdle);
    const localStatusData = {
        online: statusData.online,
        idle: statusData.idle,
        lastSeen: Date.now(),
        username: username
    };

    if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
        try { db.ref(`userStatus/${username}`).update(statusData); } catch {}
        try { db.ref(`accounts/${username}`).update({ lastSeen: statusData.lastSeen, online: statusData.online }); } catch {}
    }
    
    // Используем глобальную переменную userStatuses
    userStatuses[username] = localStatusData;
    
    const myStatusElement = document.getElementById('userStatus');
    if (myStatusElement) {
        if (statusData.online) {
            myStatusElement.textContent = statusData.idle ? "Неактивен" : "В сети";
            myStatusElement.className = statusData.idle ? "user-status idle" : "user-status";
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
    // Важно: не слушаем "userStatus" целиком — это может быть огромная ветка,
    // и на мобилках/в WebView даёт фризы и задержки ввода.
    // Статусы друзей подписываются точечно в chat.js (renderFriends).
    return;
}

function setupNetworkMonitoring() {
    // navigator.onLine / offline-events часто "врут" в Android WebView.
    // Для чата важнее реальное соединение с Firebase RTDB: /.info/connected
    let last = null;
    let offlineTimer = null;

    if (networkConnectedRef && networkConnectedHandler) {
        try { networkConnectedRef.off("value", networkConnectedHandler); } catch {}
        networkConnectedRef = null;
        networkConnectedHandler = null;
    }
    if (browserOnlineHandler) {
        window.removeEventListener('online', browserOnlineHandler);
        browserOnlineHandler = null;
    }
    if (browserOfflineHandler) {
        window.removeEventListener('offline', browserOfflineHandler);
        browserOfflineHandler = null;
    }

    const setConnected = (connected) => {
        const next = !!connected;
        if (last === next) return;
        const hadKnownState = last !== null;
        last = next;

        if (offlineTimer) {
            clearTimeout(offlineTimer);
            offlineTimer = null;
        }

        if (next) {
            isOnline = true;
            window.firebaseConnected = true;
            if (username) {
                setupPresenceDisconnectHook();
                updateMyStatus(true, false);
            }
            if (hadKnownState) showNotification("Сеть", "Соединение восстановлено", "success");
            if (typeof flushPendingQueue === 'function') flushPendingQueue();
            return;
        }

        // Небольшая задержка, чтобы не показывать "Нет сети" из‑за кратких просадок.
        offlineTimer = setTimeout(() => {
            isOnline = false;
            window.firebaseConnected = false;
            if (username) updateMyStatus(false, false);
            if (hadKnownState) showNotification("Сеть", "Нет соединения. Отправка будет в очереди", "warning");
        }, 1200);
    };

    try {
        if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
            networkConnectedRef = db.ref(".info/connected");
            networkConnectedHandler = s => setConnected(s.val() === true);
            networkConnectedRef.on("value", networkConnectedHandler);
        }
    } catch {
        // ignore
    }

    browserOnlineHandler = () => setConnected(true);
    browserOfflineHandler = () => setConnected(false);
    window.addEventListener('online', browserOnlineHandler);
    window.addEventListener('offline', browserOfflineHandler);
}
