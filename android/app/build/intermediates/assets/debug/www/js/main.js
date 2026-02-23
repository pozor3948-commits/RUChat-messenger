/* ==========================================================
   2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (ОСТАВЛЯЕМ ТОЛЬКО УНИКАЛЬНЫЕ)
   ========================================================== */
let username = "";
let currentChatId = null;
let chatRef = null;
let isGroupChat = false;
let userStatusRef = null;
let isOnline = navigator.onLine;
let friendStatusListeners = {};
let currentChatPartner = null;
let activityCheckInterval = null;
let typingTimeout = null;
let isTyping = false;
let voiceRecordInterval = null;
let voiceRecordTime = 0;

// для медиа и голосовых
let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;

/* ==========================================================
   ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Обновляем глобальную переменную isMobile
    isMobile = window.innerWidth <= 768;

    // Проверка блокировки при загрузке (если пользователь уже в системе)
    checkBlockOnLoad();

    setupNetworkMonitoring();
    document.getElementById('callButton').classList.remove('active');
    document.getElementById("text").addEventListener("input", updateSendButton);
    updateSendButton();
    checkMobile();
    if (typeof setupMobileInputFixes === 'function') setupMobileInputFixes();

    if (isMobile && currentChatId) {
        if (typeof openChatCommon === 'function') {
            openChatCommon();
        }
    }
});

// Проверка блокировки при загрузке страницы
async function checkBlockOnLoad() {
    // Ждём немного пока инициализируется username
    setTimeout(async () => {
        const currentUser = username || localStorage.getItem('ruchat_device_user');
        if (!currentUser) return;

        try {
            // Проверяем blockedUsers
            const blockedSnap = await db.ref("blockedUsers/" + currentUser).get();
            if (blockedSnap.exists() && blockedSnap.val().blocked === true) {
                if (typeof blockAppInterface === 'function') blockAppInterface();
                if (typeof showBlockedMessage === 'function') showBlockedMessage(blockedSnap.val());
                return;
            }

            // Проверяем accounts.blocked
            const accountSnap = await db.ref("accounts/" + currentUser).get();
            const accountData = accountSnap.val();
            if (accountData && accountData.blocked && accountData.blocked.admin === true) {
                if (typeof blockAppInterface === 'function') blockAppInterface();
                if (typeof showBlockedMessage === 'function') {
                    showBlockedMessage({ reason: "Нарушение правил пользования мессенджером", blockedAt: Date.now() });
                }
                return;
            }
        } catch (e) {
            console.warn("Ошибка проверки блокировки при загрузке:", e.message);
        }
    }, 500);
}
