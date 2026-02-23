/* ==========================================================
   2. Р“Р›РћР‘РђР›Р¬РќР«Р• РџР•Р Р•РњР•РќРќР«Р• (РћРЎРўРђР’Р›РЇР•Рњ РўРћР›Р¬РљРћ РЈРќРРљРђР›Р¬РќР«Р•)
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

// РґР»СЏ РјРµРґРёР° Рё РіРѕР»РѕСЃРѕРІС‹С…
let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;

/* ==========================================================
   РРќРР¦РРђР›РР—РђР¦РРЇ РџР РР›РћР–Р•РќРРЇ
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // РћР±РЅРѕРІР»СЏРµРј РіР»РѕР±Р°Р»СЊРЅСѓСЋ РїРµСЂРµРјРµРЅРЅСѓСЋ isMobile
    isMobile = window.innerWidth <= 768;
    
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
