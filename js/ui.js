/* ==========================================================
   13. РђРљРўРР’РќРћРЎРўР¬ / РЎР•РўР¬ / РњРћР‘РР›Р¬РќРћРЎРўР¬
   ========================================================== */

// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј РіР»РѕР±Р°Р»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ
if (typeof isMobile === 'undefined') {
    isMobile = window.innerWidth <= 768;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

function closeChat() {
    if (!isMobile) return;
    currentChatId = null; 
    currentChatPartner = null;
    document.getElementById('chatWith').textContent = 'Р’С‹Р±РµСЂРёС‚Рµ С‡Р°С‚';
    document.getElementById('chatMembers').textContent = '';
    document.getElementById('mobileChatStatus').textContent = 'Р’С‹Р±РµСЂРёС‚Рµ С‡Р°С‚';
    document.getElementById('messages').innerHTML = '';
    document.getElementById('mobileBackBtn').classList.remove('active');
    if (chatRef) { 
        chatRef.off(); 
        chatRef = null; 
    }
}

function updateSendButton() {
    const ti = document.getElementById("text");
    const btn = document.getElementById("sendBtn");
    if (ti.value.trim()) {
        btn.classList.add("active");
    } else {
        btn.classList.remove("active");
    }
}

function handleKeyPress(e) {
    if (e.key === "Enter" && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
    }
    updateSendButton();
}

function searchChats(q) {
    document.querySelectorAll(".contact-item, .group-item").forEach(it => {
        const n = it.querySelector(".contact-name").textContent.toLowerCase();
        it.style.display = n.includes(q.toLowerCase()) ? "flex" : "none";
    });
}

// Р¤СѓРЅРєС†РёСЏ РїРѕРєР°Р·Р°/СЃРєСЂС‹С‚РёСЏ СЌРјРѕРґР·Рё-РїРёРєРµСЂР°
function toggleEmojiPicker() {
    const picker = document.getElementById("emojiPicker");
    const isActive = picker.classList.contains("active");
    
    // РЎРєСЂС‹РІР°РµРј РґСЂСѓРіРёРµ РјРµРЅСЋ
    document.getElementById("attachmentMenu").classList.remove("active");
    document.getElementById("recordTypeMenu").classList.remove("active");
    
    // РџРµСЂРµРєР»СЋС‡Р°РµРј СЌРјРѕРґР·Рё-РїРёРєРµСЂ
    if (isActive) {
        picker.classList.remove("active");
    } else {
        picker.classList.add("active");
        
        // РџРѕР·РёС†РёРѕРЅРёСЂСѓРµРј РЅР° РјРѕР±РёР»СЊРЅС‹С…
        if (isMobile) {
            positionEmojiPickerForMobile();
        }
    }
}

// Р¤СѓРЅРєС†РёСЏ РїРѕРєР°Р·Р°/СЃРєСЂС‹С‚РёСЏ РјРµРЅСЋ РїСЂРёРєСЂРµРїР»РµРЅРёСЏ
function toggleAttachmentMenu() {
    const menu = document.getElementById("attachmentMenu");
    const isActive = menu.classList.contains("active");
    
    // РЎРєСЂС‹РІР°РµРј РґСЂСѓРіРёРµ РјРµРЅСЋ
    document.getElementById("emojiPicker").classList.remove("active");
    document.getElementById("recordTypeMenu").classList.remove("active");
    
    // РџРµСЂРµРєР»СЋС‡Р°РµРј РјРµРЅСЋ РїСЂРёРєСЂРµРїР»РµРЅРёСЏ
    if (isActive) {
        menu.classList.remove("active");
    } else {
        menu.classList.add("active");
        
        // РџРѕР·РёС†РёРѕРЅРёСЂСѓРµРј РЅР° РјРѕР±РёР»СЊРЅС‹С…
        if (isMobile) {
            positionAttachmentMenuForMobile();
        }
    }
}

// Р¤СѓРЅРєС†РёСЏ РїРѕРєР°Р·Р° РјРµРЅСЋ РІС‹Р±РѕСЂР° С‚РёРїР° Р·Р°РїРёСЃРё
function showRecordTypeMenu() {
    const menu = document.getElementById("recordTypeMenu");
    const isActive = menu.classList.contains("active");
    
    // РЎРєСЂС‹РІР°РµРј РґСЂСѓРіРёРµ РјРµРЅСЋ
    document.getElementById("attachmentMenu").classList.remove("active");
    document.getElementById("emojiPicker").classList.remove("active");
    
    // РџРµСЂРµРєР»СЋС‡Р°РµРј РјРµРЅСЋ РІС‹Р±РѕСЂР° С‚РёРїР° Р·Р°РїРёСЃРё
    if (isActive) {
        menu.classList.remove("active");
    } else {
        menu.classList.add("active");
        
        // РџРѕР·РёС†РёРѕРЅРёСЂСѓРµРј РЅР° РјРѕР±РёР»СЊРЅС‹С…
        if (isMobile) {
            positionRecordTypeMenuForMobile();
        }
    }
}

// РџРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ СЌРјРѕРґР·Рё-РїРёРєРµСЂР° РЅР° РјРѕР±РёР»СЊРЅС‹С…
function positionEmojiPickerForMobile() {
    const picker = document.getElementById("emojiPicker");
    const inputContainer = document.querySelector('.message-input-container');
    
    if (!picker || !inputContainer) return;
    
    const inputRect = inputContainer.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Р Р°Р·РјРµС‰Р°РµРј РЅР°Рґ РїРѕР»РµРј РІРІРѕРґР°
    picker.style.bottom = `${viewportHeight - inputRect.top + 10}px`;
    picker.style.left = '10px';
    picker.style.right = '10px';
    picker.style.width = 'calc(100% - 20px)';
}

// РџРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РјРµРЅСЋ РїСЂРёРєСЂРµРїР»РµРЅРёСЏ РЅР° РјРѕР±РёР»СЊРЅС‹С…
function positionAttachmentMenuForMobile() {
    const menu = document.getElementById("attachmentMenu");
    const attachmentBtn = document.querySelector('.attachment-btn');
    
    if (!menu || !attachmentBtn) return;
    
    const btnRect = attachmentBtn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // Р Р°Р·РјРµС‰Р°РµРј СЂСЏРґРѕРј СЃ РєРЅРѕРїРєРѕР№
    if (btnRect.left < viewportWidth / 2) {
        // РЎР»РµРІР°
        menu.style.left = '10px';
        menu.style.right = 'auto';
    } else {
        // РЎРїСЂР°РІР°
        menu.style.left = 'auto';
        menu.style.right = '10px';
    }
    
    menu.style.bottom = '85px';
}

// РџРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РјРµРЅСЋ РІС‹Р±РѕСЂР° С‚РёРїР° Р·Р°РїРёСЃРё РЅР° РјРѕР±РёР»СЊРЅС‹С…
function positionRecordTypeMenuForMobile() {
    const menu = document.getElementById("recordTypeMenu");
    const recordBtn = document.querySelector('.icon-btn[onclick*="showRecordTypeMenu"]');
    
    if (!menu || !recordBtn) return;
    
    const btnRect = recordBtn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // Р Р°Р·РјРµС‰Р°РµРј СЂСЏРґРѕРј СЃ РєРЅРѕРїРєРѕР№
    if (btnRect.left < viewportWidth / 2) {
        // РЎР»РµРІР°
        menu.style.left = '10px';
        menu.style.right = 'auto';
    } else {
        // РЎРїСЂР°РІР°
        menu.style.left = 'auto';
        menu.style.right = '10px';
    }
    
    menu.style.bottom = '85px';
}

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ РіРѕР»РѕСЃРѕРІРѕРіРѕ Р·РІРѕРЅРєР°
function startVoiceCall() {
    if (!currentChatId) {
        showError("Р’С‹Р±РµСЂРёС‚Рµ С‡Р°С‚ РґР»СЏ Р·РІРѕРЅРєР°!");
        return;
    }
    if (typeof startAudioCall === "function") {
        startAudioCall();
    } else {
        showError("РњРѕРґСѓР»СЊ Р·РІРѕРЅРєРѕРІ РЅРµ Р·Р°РіСЂСѓР¶РµРЅ");
    }
}

// Р¤СѓРЅРєС†РёСЏ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ С‚РµРјС‹
function toggleTheme() {
    const body = document.body;
    const isLight = body.classList.toggle('light');
    localStorage.setItem('ruchat_theme', isLight ? 'light' : 'dark');
    showNotification("Тема", isLight ? "Переключена светлая тема" : "Переключена тёмная тема", 'info');
}

// Р¤СѓРЅРєС†РёСЏ РїРѕРєР°Р·Р° РёРЅС„РѕСЂРјР°С†РёРё Рѕ С‡Р°С‚Рµ
function showChatInfo() {
    if (isGroupChat && currentChatId) {
        db.ref("groups/" + currentChatId).once("value").then(s => {
            if (s.exists()) {
                const g = s.val();
                const memberCount = Object.keys(g.members || {}).length;
                const info = `
РРЅС„РѕСЂРјР°С†РёСЏ Рѕ РіСЂСѓРїРїРµ:
в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
РќР°Р·РІР°РЅРёРµ: ${g.name}
РЈС‡Р°СЃС‚РЅРёРєРѕРІ: ${memberCount}
РЎРѕР·РґР°РЅР°: ${new Date(g.createdAt).toLocaleDateString()}
РЎРѕР·РґР°С‚РµР»СЊ: ${g.createdBy}
                `;
                alert(info);
            }
        });
    } else if (currentChatPartner) {
        const friendName = document.getElementById("chatWith").textContent;
        const status = userStatuses[friendName];
        let statusText = "Р‘С‹Р»(Р°) РЅРµРґР°РІРЅРѕ";
        
        if (status) {
            if (status.online) {
                statusText = status.idle ? "РќРµР°РєС‚РёРІРµРЅ" : "Р’ СЃРµС‚Рё";
            }
        }
        
        const info = `
РРЅС„РѕСЂРјР°С†РёСЏ Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ:
в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
РРјСЏ: ${friendName}
РЎС‚Р°С‚СѓСЃ: ${statusText}
РџРѕСЃР»РµРґРЅСЏСЏ Р°РєС‚РёРІРЅРѕСЃС‚СЊ: ${status ? new Date(status.lastSeen).toLocaleTimeString() : 'РќРµРёР·РІРµСЃС‚РЅРѕ'}
        `;
        alert(info);
    } else {
        showError("Р’С‹Р±РµСЂРёС‚Рµ С‡Р°С‚ РґР»СЏ РїСЂРѕСЃРјРѕС‚СЂР° РёРЅС„РѕСЂРјР°С†РёРё");
    }
}

// Р—Р°РіСЂСѓР¶Р°РµРј СЃРѕС…СЂР°РЅРµРЅРЅСѓСЋ С‚РµРјСѓ РїСЂРё Р·Р°РіСЂСѓР·РєРµ
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('ruchat_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light');
    }
});
