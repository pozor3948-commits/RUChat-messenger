/* ==========================================================
   RUCHAT SECRET CHATS - E2EE ENCRYPTION
   Секретные чаты с сквозным шифрованием
   Версия: 2026-03-12
   ========================================================== */

// Глобальные ключи для E2EE
let e2eeKeys = {
    publicKey: null,
    privateKey: null
};

let secretChats = {}; // Активные секретные чаты

/* ==========================================================
   ГЕНЕРАЦИЯ КЛЮЧЕЙ (Web Crypto API)
   ========================================================== */
async function generateE2EEKeys() {
    try {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256"
            },
            true,
            ["encrypt", "decrypt"]
        );
        
        e2eeKeys = keyPair;
        
        // Сохраняем публичный ключ в базе
        const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
        const publicKeyBase64 = arrayBufferToBase64(publicKeyBuffer);
        
        if (username) {
            await db.ref(`accounts/${username}/e2eePublicKey`).set(publicKeyBase64);
        }
        
        console.log('[E2EE] Ключи сгенерированы');
        return keyPair;
    } catch (e) {
        console.error('[E2EE] Ошибка генерации ключей:', e);
        return null;
    }
}

async function loadE2EEKeys() {
    if (!username) return;
    
    try {
        // Пробуем загрузить из localStorage
        const stored = localStorage.getItem(`ruchat_e2ee_keys_${username}`);
        if (stored) {
            const keys = JSON.parse(stored);
            e2eeKeys.privateKey = await importPrivateKey(keys.private);
            e2eeKeys.publicKey = await importPublicKey(keys.public);
            console.log('[E2EE] Ключи загружены из localStorage');
            return e2eeKeys;
        }
        
        // Генерируем новые если нет сохраненных
        await generateE2EEKeys();
        return e2eeKeys;
    } catch (e) {
        console.error('[E2EE] Ошибка загрузки ключей:', e);
        return null;
    }
}

async function saveE2EEKeys() {
    if (!e2eeKeys.privateKey || !e2eeKeys.publicKey) return;
    
    try {
        const privateKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", e2eeKeys.privateKey);
        const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", e2eeKeys.publicKey);
        
        const keys = {
            private: arrayBufferToBase64(privateKeyBuffer),
            public: arrayBufferToBase64(publicKeyBuffer)
        };
        
        localStorage.setItem(`ruchat_e2ee_keys_${username}`, JSON.stringify(keys));
        console.log('[E2EE] Ключи сохранены');
    } catch (e) {
        console.error('[E2EE] Ошибка сохранения ключей:', e);
    }
}

/* ==========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================================== */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

async function importPublicKey(base64) {
    const buffer = base64ToArrayBuffer(base64);
    return await window.crypto.subtle.importKey(
        "spki",
        buffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );
}

async function importPrivateKey(base64) {
    const buffer = base64ToArrayBuffer(base64);
    return await window.crypto.subtle.importKey(
        "pkcs8",
        buffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
    );
}

/* ==========================================================
   ШИФРОВАНИЕ / РАСШИФРОВКА
   ========================================================== */
async function encryptMessage(message, recipientPublicKey) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(message));
        
        const publicKey = await importPublicKey(recipientPublicKey);
        
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            publicKey,
            data
        );
        
        return arrayBufferToBase64(encrypted);
    } catch (e) {
        console.error('[E2EE] Ошибка шифрования:', e);
        return null;
    }
}

async function decryptMessage(encryptedBase64) {
    try {
        const encrypted = base64ToArrayBuffer(encryptedBase64);
        
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            e2eeKeys.privateKey,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    } catch (e) {
        console.error('[E2EE] Ошибка расшифровки:', e);
        return null;
    }
}

/* ==========================================================
   СЕКРЕТНЫЕ ЧАТЫ
   ========================================================== */
async function startSecretChat(partnerUsername) {
    if (!username || !partnerUsername) {
        showError('Выберите пользователя для секретного чата');
        return;
    }
    
    showLoading();
    
    try {
        // Получаем публичный ключ собеседника
        const snap = await db.ref(`accounts/${partnerUsername}/e2eePublicKey`).once('value');
        const partnerPublicKey = snap.val();
        
        if (!partnerPublicKey) {
            hideLoading();
            showError('Пользователь не поддерживает E2EE шифрование');
            return;
        }
        
        // Создаем секретный чат
        const chatId = `secret_${[username, partnerUsername].sort().join('_')}`;
        
        secretChats[chatId] = {
            partner: partnerUsername,
            partnerPublicKey: partnerPublicKey,
            createdAt: Date.now(),
            encrypted: true
        };
        
        // Сохраняем информацию о чате
        await db.ref(`secretChats/${username}/${chatId}`).set({
            partner: partnerUsername,
            createdAt: Date.now(),
            encrypted: true
        });
        
        hideLoading();
        showNotification('Секретный чат', `Чат с @${partnerUsername} создан`, 'success');
        
        // Открываем чат
        openSecretChat(chatId, partnerUsername);
        
    } catch (e) {
        hideLoading();
        console.error('[E2EE] Ошибка создания секретного чата:', e);
        showError('Не удалось создать секретный чат');
    }
}

function openSecretChat(chatId, partnerUsername) {
    isGroupChat = false;
    currentChatId = chatId;
    currentChatPartner = partnerUsername;
    
    // Обновляем UI
    document.getElementById("chatWith").textContent = `🔒 ${partnerUsername}`;
    document.getElementById("mobileChatTitle").textContent = `🔒 ${partnerUsername}`;
    
    // Показываем индикатор шифрования
    showSecretChatIndicator();
    
    // Загружаем сообщения
    loadSecretChatMessages(chatId);
}

function showSecretChatIndicator() {
    const header = document.getElementById('chatHeader');
    if (!header) return;
    
    // Удаляем старый индикатор если есть
    const existing = header.querySelector('.secret-chat-indicator');
    if (existing) existing.remove();
    
    const indicator = document.createElement('div');
    indicator.className = 'secret-chat-indicator';
    indicator.innerHTML = `
        <span class="lock-icon">🔒</span>
        <span>Сообщения зашифрованы E2EE</span>
    `;
    indicator.style.cssText = `
        background: linear-gradient(45deg, rgba(0, 136, 204, 0.2), rgba(0, 180, 255, 0.1));
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 12px;
        color: #00b4ff;
        margin: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    header.insertBefore(indicator, header.firstChild);
}

async function sendSecretMessage(text) {
    if (!currentChatId || !secretChats[currentChatId]) {
        return false;
    }
    
    const chat = secretChats[currentChatId];
    
    try {
        // Шифруем сообщение
        const encrypted = await encryptMessage(
            { text: text, time: Date.now() },
            chat.partnerPublicKey
        );
        
        if (!encrypted) {
            showError('Ошибка шифрования');
            return false;
        }
        
        // Отправляем зашифрованное сообщение
        const messageData = {
            from: username,
            time: Date.now(),
            type: 'secret_message',
            encryptedData: encrypted,
            chatId: currentChatId
        };
        
        await db.ref(`secretMessages/${currentChatId}`).push(messageData);
        
        // Добавляем в UI
        addSecretMessageToChat({
            from: username,
            text: text,
            time: Date.now(),
            encrypted: true
        });
        
        return true;
    } catch (e) {
        console.error('[E2EE] Ошибка отправки:', e);
        showError('Ошибка отправки зашифрованного сообщения');
        return false;
    }
}

async function loadSecretChatMessages(chatId) {
    try {
        const snap = await db.ref(`secretMessages/${chatId}`).once('value');
        
        if (!snap.exists()) {
            document.getElementById('messages').innerHTML = '';
            return;
        }
        
        const messages = [];
        snap.forEach(child => {
            const msg = child.val();
            msg.id = child.key;
            messages.push(msg);
        });
        
        // Расшифровываем сообщения
        const decryptedMessages = [];
        for (const msg of messages) {
            if (msg.encryptedData) {
                const decrypted = await decryptMessage(msg.encryptedData);
                if (decrypted) {
                    decryptedMessages.push({
                        id: msg.id,
                        from: msg.from,
                        text: decrypted.text,
                        time: decrypted.time || msg.time,
                        encrypted: true
                    });
                }
            }
        }
        
        // Отображаем
        document.getElementById('messages').innerHTML = '';
        decryptedMessages.forEach(msg => addSecretMessageToChat(msg));
        
    } catch (e) {
        console.error('[E2EE] Ошибка загрузки:', e);
    }
}

function addSecretMessageToChat(message) {
    const container = document.getElementById('messages');
    if (!container) return;
    
    const wrap = document.createElement('div');
    wrap.className = `message-wrapper ${message.from === username ? 'me' : 'other'} secret-message`;
    wrap.id = `message_${message.id || Date.now()}`;
    
    const time = new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    wrap.innerHTML = `
        <div class="message ${message.from === username ? 'me' : 'other'}">
            <div class="message-text">🔒 ${escapeHtml(message.text)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
}

/* ==========================================================
   UI ФУНКЦИИ
   ========================================================== */
function showSecretChatsModal() {
    const modal = document.createElement('div');
    modal.className = 'secret-chats-modal-overlay';
    modal.innerHTML = `
        <div class="secret-chats-modal">
            <div class="secret-chats-header">
                <h2>🔒 Секретные чаты</h2>
                <button class="close-btn" onclick="this.closest('.secret-chats-modal-overlay').remove()">✕</button>
            </div>
            <div class="secret-chats-list" id="secretChatsList">
                <div class="loading">Загрузка...</div>
            </div>
            <div class="secret-chats-actions">
                <button class="login-btn" onclick="showNewSecretChatModal()">Новый секретный чат</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    loadSecretChatsList();
}

async function loadSecretChatsList() {
    const list = document.getElementById('secretChatsList');
    if (!list || !username) return;
    
    try {
        const snap = await db.ref(`secretChats/${username}`).once('value');
        
        if (!snap.exists()) {
            list.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><div class="title">Нет секретных чатов</div></div>';
            return;
        }
        
        let html = '';
        snap.forEach(child => {
            const chat = child.val();
            const chatId = child.key;
            const date = new Date(chat.createdAt).toLocaleDateString('ru-RU');
            
            html += `
                <div class="secret-chat-item" onclick="openSecretChat('${chatId}', '${chat.partner}')">
                    <div class="secret-chat-icon">🔒</div>
                    <div class="secret-chat-info">
                        <div class="secret-chat-name">${chat.partner}</div>
                        <div class="secret-chat-meta">Создан: ${date}</div>
                    </div>
                </div>
            `;
        });
        
        list.innerHTML = html;
    } catch (e) {
        console.error('[E2EE] Ошибка загрузки списка:', e);
        list.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
}

function showNewSecretChatModal() {
    const modal = document.createElement('div');
    modal.className = 'new-secret-chat-modal-overlay';
    modal.innerHTML = `
        <div class="new-secret-chat-modal">
            <div class="new-secret-chat-header">
                <h2>Новый секретный чат</h2>
                <button class="close-btn" onclick="this.closest('.new-secret-chat-modal-overlay').remove()">✕</button>
            </div>
            <div class="new-secret-chat-body">
                <p class="new-secret-chat-description">
                    Выберите пользователя для начала секретного чата с E2EE шифрованием.
                </p>
                <input type="text" class="new-secret-chat-input" id="secretChatPartnerInput" 
                       placeholder="Имя пользователя" autocomplete="off">
            </div>
            <div class="new-secret-chat-actions">
                <button class="login-btn" onclick="startSecretChatFromInput()">Начать чат</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function startSecretChatFromInput() {
    const partner = document.getElementById('secretChatPartnerInput').value.trim();
    if (!partner) {
        showError('Введите имя пользователя');
        return;
    }
    
    document.querySelector('.new-secret-chat-modal-overlay')?.remove();
    startSecretChat(partner);
}

/* ==========================================================
   ЭКСПОРТ ФУНКЦИЙ
   ========================================================== */
window.startSecretChat = startSecretChat;
window.showSecretChatsModal = showSecretChatsModal;
window.sendSecretMessage = sendSecretMessage;
window.loadE2EEKeys = loadE2EEKeys;
window.generateE2EEKeys = generateE2EEKeys;
window.saveE2EEKeys = saveE2EEKeys;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    if (username) {
        await loadE2EEKeys();
        await saveE2EEKeys();
    }
    console.log('[E2EE] Модуль загружен');
});
