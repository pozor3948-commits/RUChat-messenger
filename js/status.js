/* ==========================================================
   4. РЎРўРђРўРЈРЎР« РџРћР›Р¬Р—РћР’РђРўР•Р›Р•Р™ (РРЎРџРћР›Р¬Р—РЈР•Рњ Р“Р›РћР‘РђР›Р¬РќРЈР® userStatuses)
   ========================================================== */
function getFriendStatusText(st) {
    if (!st) return "Р‘С‹Р»(Р°) РЅРµРґР°РІРЅРѕ";
    if (st.online === true) return st.idle ? "РќРµР°РєС‚РёРІРµРЅ" : "Р’ СЃРµС‚Рё";
    return "Р‘С‹Р»(Р°) РЅРµРґР°РІРЅРѕ";
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

function updateFriendStatusInList(friendName, statusData) {
    // РСЃРїРѕР»СЊР·СѓРµРј РіР»РѕР±Р°Р»СЊРЅСѓСЋ РїРµСЂРµРјРµРЅРЅСѓСЋ userStatuses РёР· utils.js
    userStatuses[friendName] = statusData;
    const onlineDot = document.getElementById(`online_${friendName}`);
    const lastSeenElement = document.getElementById(`lastSeen_${friendName}`);
    if (onlineDot) onlineDot.className = getOnlineDotClass(statusData);
    if (lastSeenElement) {
        lastSeenElement.textContent = getFriendStatusText(statusData);
        lastSeenElement.className = `last-seen ${getFriendStatusClass(statusData)}`;
    }
    if (currentChatPartner === friendName && !isGroupChat) updateChatStatus(friendName, statusData);
}

function updateChatStatus(friendName, statusData) {
    const chatMembersElement = document.getElementById("chatMembers");
    const mobileChatStatus = document.getElementById("mobileChatStatus");
    if (chatMembersElement && mobileChatStatus) {
        const statusText = getFriendStatusText(statusData);
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
    
    // РСЃРїРѕР»СЊР·СѓРµРј РіР»РѕР±Р°Р»СЊРЅСѓСЋ РїРµСЂРµРјРµРЅРЅСѓСЋ userStatuses
    userStatuses[username] = statusData;
    
    const myStatusElement = document.getElementById('userStatus');
    if (myStatusElement) {
        if (isOnlineStatus) {
            myStatusElement.textContent = isIdle ? "РќРµР°РєС‚РёРІРµРЅ" : "Р’ СЃРµС‚Рё";
            myStatusElement.className = isIdle ? "user-status idle" : "user-status";
        } else {
            myStatusElement.textContent = "Р‘С‹Р»(Р°) РЅРµРґР°РІРЅРѕ";
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
    window.addEventListener('online', () => {
        isOnline = true; updateMyStatus(true, false); showNotification("РЎРµС‚СЊ", "РЎРѕРµРґРёРЅРµРЅРёРµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРѕ");
    });
    window.addEventListener('offline', () => {
        isOnline = false; updateMyStatus(false, false); showError("РќРµС‚ СЃРѕРµРґРёРЅРµРЅРёСЏ СЃ РёРЅС‚РµСЂРЅРµС‚РѕРј");
    });
}
