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
    
    setupNetworkMonitoring();
    if (!navigator.onLine) showError('Нет соединения с интернетом');
    document.getElementById('callButton').classList.remove('active');
    document.getElementById("text").addEventListener("input", updateSendButton);
    updateSendButton();
    checkMobile();

    if (isMobile && currentChatId) {
        if (typeof openChatCommon === 'function') {
            openChatCommon();
        }
    }
});