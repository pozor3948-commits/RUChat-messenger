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

function shouldUsePerfMode() {
    const cores = Number(navigator.hardwareConcurrency || 0);
    const memory = Number(navigator.deviceMemory || 0);
    const isLowPowerDevice = (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4);
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return isLowPowerDevice || reducedMotion;
}

function setupPerformanceMode() {
    const body = document.body;
    if (!body) return;
    const apply = () => body.classList.toggle('perf-mode', shouldUsePerfMode());
    apply();
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (typeof media.addEventListener === 'function') media.addEventListener('change', apply);
    else if (typeof media.addListener === 'function') media.addListener(apply);
}

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
    setupPerformanceMode();

    if (isMobile && currentChatId) {
        if (typeof openChatCommon === 'function') {
            openChatCommon();
        }
    }
});
