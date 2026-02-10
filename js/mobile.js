/* ==========================================================
   13. РђРљРўРР’РќРћРЎРўР¬ / РЎР•РўР¬ / РњРћР‘РР›Р¬РќРћРЎРўР¬
   ========================================================== */
function checkMobile() {
    // РСЃРїРѕР»СЊР·СѓРµРј РіР»РѕР±Р°Р»СЊРЅСѓСЋ РїРµСЂРµРјРµРЅРЅСѓСЋ isMobile РёР· utils.js
    isMobile = window.innerWidth <= 768;
    if (username) {
        const callBtn = document.getElementById('callButton');
        if (callBtn) {
            callBtn.classList.add('active');
            callBtn.style.display = 'flex';
        }
    }
    if (isMobile && currentChatId) document.getElementById('mobileBackBtn').classList.add('active');
    else document.getElementById('mobileBackBtn').classList.remove('active');
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
//  Р”РѕРїРѕР»РЅРµРЅРёРµ РґР»СЏ РјРѕР±РёР»СЊРЅРѕРіРѕ РїРѕРІРµРґРµРЅРёСЏ (РєР°Рє РІ Telegram)
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function openChatCommon() {
    if (!isMobile) return;

    // РџСЂСЏС‡РµРј СЃРїРёСЃРѕРє С‡Р°С‚РѕРІ
    document.getElementById('sidebar').classList.add('hidden-on-mobile');

    // РџРѕРєР°Р·С‹РІР°РµРј С‡Р°С‚ РЅР° РІРµСЃСЊ СЌРєСЂР°РЅ
    document.getElementById('chatContainer').classList.add('active');

    // РџРѕРєР°Р·С‹РІР°РµРј РєРЅРѕРїРєСѓ "РЅР°Р·Р°Рґ"
    document.getElementById('mobileBackBtn').classList.add('active');

    // РћР±РЅРѕРІР»СЏРµРј Р·Р°РіРѕР»РѕРІРѕРє РјРѕР±РёР»СЊРЅРѕРіРѕ С…РµРґРµСЂР°
    const chatTitle = document.getElementById('chatWith').textContent;
    document.getElementById('mobileChatTitle').textContent = chatTitle || 'Р§Р°С‚';

    // РЎРєСЂС‹РІР°РµРј stories (РєР°Рє РІ TG)
    document.getElementById('storiesContainer').style.display = 'none';

    const callBtn = document.getElementById('callButton');
    if (callBtn) callBtn.classList.add('active');
}

function closeChatMobile() {
    if (!isMobile) return;

    // Р’РѕР·РІСЂР°С‰Р°РµРј СЃРїРёСЃРѕРє С‡Р°С‚РѕРІ
    document.getElementById('sidebar').classList.remove('hidden-on-mobile');

    // РЈР±РёСЂР°РµРј С‡Р°С‚ СЃ СЌРєСЂР°РЅР°
    document.getElementById('chatContainer').classList.remove('active');

    // РџСЂСЏС‡РµРј РєРЅРѕРїРєСѓ РЅР°Р·Р°Рґ
    document.getElementById('mobileBackBtn').classList.remove('active');

    // РЎР±СЂР°СЃС‹РІР°РµРј Р·Р°РіРѕР»РѕРІРѕРє
    document.getElementById('mobileChatTitle').textContent = 'RuChat';
    document.getElementById('mobileChatStatus').textContent = 'Р’С‹Р±РµСЂРёС‚Рµ С‡Р°С‚';

    // Р’РѕР·РІСЂР°С‰Р°РµРј stories
    document.getElementById('storiesContainer').style.display = 'block';

    // РћС‡РёС‰Р°РµРј С‚РµРєСѓС‰РёР№ С‡Р°С‚
    currentChatId = null;
    currentChatPartner = null;
    if (chatRef) {
        chatRef.off();
        chatRef = null;
    }
    document.getElementById('messages').innerHTML = '';
}

// РџРµСЂРµРѕРїСЂРµРґРµР»СЏРµРј СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ С„СѓРЅРєС†РёРё РѕС‚РєСЂС‹С‚РёСЏ С‡Р°С‚Р°
const originalOpenPrivateChat = openPrivateChat;
openPrivateChat = function(fn) {
    originalOpenPrivateChat(fn);
    openChatCommon();
};

const originalOpenGroupChat = openGroupChat;
openGroupChat = function(g, gid) {
    originalOpenGroupChat(g, gid);
    openChatCommon();
};

// РџРµСЂРµРѕРїСЂРµРґРµР»СЏРµРј РєРЅРѕРїРєСѓ "РЅР°Р·Р°Рґ"
const originalCloseChat = closeChat;
closeChat = function() {
    originalCloseChat();
    closeChatMobile();
};

// Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ вЂ” РїСЂРё СЂРµСЃР°Р№Р·Рµ РѕРєРЅР°
window.addEventListener('resize', () => {
    const wasMobile = isMobile;
    isMobile = window.innerWidth <= 768;

    if (wasMobile !== isMobile && currentChatId) {
        if (isMobile) {
            openChatCommon();
        } else {
            closeChatMobile();
            document.getElementById('sidebar').classList.remove('hidden-on-mobile');
            document.getElementById('chatContainer').classList.remove('active');
        }
    }

    checkMobile();
});

/* ==========================================================
   РРЎРџР РђР’Р›Р•РќРР• РџРћР—РР¦РРћРќРР РћР’РђРќРРЇ РњР•РќР® РќРђ РњРћР‘РР›Р¬РќР«РҐ
   ========================================================== */
function adjustMenuPositionForMobile() {
    // РСЃРїРѕР»СЊР·СѓРµРј РіР»РѕР±Р°Р»СЊРЅСѓСЋ РїРµСЂРµРјРµРЅРЅСѓСЋ isMobile
    if (!isMobile) return;
    
    const menus = [
        document.getElementById('attachmentMenu'),
        document.getElementById('recordTypeMenu'),
        document.getElementById('emojiPicker')
    ];
    
    menus.forEach(menu => {
        if (menu) {
            // Р“Р°СЂР°РЅС‚РёСЂСѓРµРј, С‡С‚Рѕ РјРµРЅСЋ Р±СѓРґРµС‚ РїРѕРІРµСЂС… С‡Р°С‚Р°
            menu.style.zIndex = '1004';
            
            // РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕРµ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ
            if (menu.classList.contains('active')) {
                const inputContainer = document.querySelector('.message-input-container');
                if (inputContainer) {
                    const rect = inputContainer.getBoundingClientRect();
                    menu.style.bottom = `${rect.height + 20}px`;
                }
            }
        }
    });
}

// Р’С‹Р·С‹РІР°РµРј РїСЂРё РёР·РјРµРЅРµРЅРёСЏС…
window.addEventListener('resize', adjustMenuPositionForMobile);
document.addEventListener('DOMContentLoaded', adjustMenuPositionForMobile);

// РџРµСЂРµС…РІР°С‚С‹РІР°РµРј РѕС‚РєСЂС‹С‚РёРµ РјРµРЅСЋ
const originalToggleAttachmentMenu = window.toggleAttachmentMenu;
window.toggleAttachmentMenu = function() {
    originalToggleAttachmentMenu();
    setTimeout(adjustMenuPositionForMobile, 50);
};

const originalToggleEmojiPicker = window.toggleEmojiPicker;
window.toggleEmojiPicker = function() {
    originalToggleEmojiPicker();
    setTimeout(adjustMenuPositionForMobile, 50);
};
