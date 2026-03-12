/* ==========================================================
   RUCHAT ADVANCED FEATURES
   Продвинутые функции мессенджера
   Версия: 2026-03-12-v2
   ========================================================== */

/* ==========================================================
   1. СЕССИИ УСТРОЙСТВ
   ========================================================== */
let deviceSessions = [];

async function loadDeviceSessions() {
    if (!username) return;
    try {
        const snap = await db.ref(`accounts/${username}/devices`).once('value');
        deviceSessions = [];
        if (snap.exists()) {
            const devices = snap.val();
            Object.keys(devices).forEach(token => {
                const device = devices[token];
                deviceSessions.push({
                    token: token,
                    createdAt: device.createdAt,
                    updatedAt: device.updatedAt,
                    userAgent: device.userAgent || '',
                    fcmToken: device.fcmToken || '',
                    isCurrent: token === getDeviceToken()
                });
            });
        }
    } catch (e) {
        console.error('Ошибка загрузки сессий:', e);
    }
}

function getDeviceToken() {
    return localStorage.getItem('ruchat_device_token') || 'unknown';
}

function showDeviceSessionsModal() {
    loadDeviceSessions();
    
    setTimeout(() => {
        const modal = document.createElement('div');
        modal.className = 'sessions-modal-overlay';
        modal.innerHTML = `
            <div class="sessions-modal">
                <div class="sessions-header">
                    <h2>Активные сессии</h2>
                    <button class="close-btn" onclick="this.closest('.sessions-modal-overlay').remove()">✕</button>
                </div>
                <div class="sessions-list" id="sessionsList">
                    <div class="loading">Загрузка...</div>
                </div>
                <div class="sessions-actions">
                    <button class="login-btn danger" onclick="terminateAllOtherSessions()">Завершить все другие сессии</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        renderSessionsList();
    }, 100);
}

async function renderSessionsList() {
    const list = document.getElementById('sessionsList');
    if (!list) return;
    
    await loadDeviceSessions();
    
    if (deviceSessions.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="icon">📱</div><div class="title">Нет активных сессий</div></div>';
        return;
    }
    
    let html = '';
    deviceSessions.forEach(session => {
        const date = new Date(session.createdAt).toLocaleString('ru-RU');
        const updated = new Date(session.updatedAt).toLocaleString('ru-RU');
        const browser = getBrowserFromUA(session.userAgent);
        const isCurrent = session.isCurrent;
        
        html += `
            <div class="session-item ${isCurrent ? 'current' : ''}">
                <div class="session-icon">${isCurrent ? '💻' : '📱'}</div>
                <div class="session-info">
                    <div class="session-name">${browser} ${isCurrent ? '(Это устройство)' : ''}</div>
                    <div class="session-meta">
                        <div>Вход: ${date}</div>
                        <div>Активность: ${updated}</div>
                    </div>
                </div>
                ${!isCurrent ? `
                    <button class="terminate-btn" onclick="terminateSession('${session.token}')">
                        Завершить
                    </button>
                ` : '<div class="current-badge">Текущая</div>'}
            </div>
        `;
    });
    
    list.innerHTML = html;
}

function getBrowserFromUA(ua) {
    if (!ua) return 'Неизвестное устройство';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    return 'Браузер';
}

async function terminateSession(token) {
    if (!confirm('Завершить эту сессию?')) return;
    
    try {
        await db.ref(`accounts/${username}/devices/${token}`).remove();
        showNotification('Сессии', 'Сессия завершена', 'success');
        renderSessionsList();
    } catch (e) {
        showError('Не удалось завершить сессию');
    }
}

async function terminateAllOtherSessions() {
    if (!confirm('Завершить ВСЕ сессии кроме текущей?')) return;
    
    try {
        const currentToken = getDeviceToken();
        const snap = await db.ref(`accounts/${username}/devices`).once('value');
        if (snap.exists()) {
            const updates = {};
            Object.keys(snap.val()).forEach(token => {
                if (token !== currentToken) {
                    updates[`accounts/${username}/devices/${token}`] = null;
                }
            });
            await db.ref().update(updates);
        }
        showNotification('Сессии', 'Все другие сессии завершены', 'success');
        renderSessionsList();
    } catch (e) {
        showError('Не удалось завершить сессии');
    }
}

/* ==========================================================
   2. ДВУХЭТАПНАЯ ПРОВЕРКА (PIN)
   ========================================================== */
function getTwoFactorPIN() {
    return localStorage.getItem(`ruchat_2fa_${username}`);
}

function setTwoFactorPIN(pin) {
    localStorage.setItem(`ruchat_2fa_${username}`, pin);
}

function hasTwoFactorPIN() {
    return getTwoFactorPIN() !== null;
}

function showTwoFactorSetupModal() {
    const modal = document.createElement('div');
    modal.className = 'twofa-modal-overlay';
    modal.innerHTML = `
        <div class="twofa-modal">
            <div class="twofa-header">
                <h2>Двухэтапная проверка</h2>
                <button class="close-btn" onclick="this.closest('.twofa-modal-overlay').remove()">✕</button>
            </div>
            <div class="twofa-content">
                <p class="twofa-description">
                    Установите PIN-код для защиты критических действий:
                    удаление чатов, смена пароля, важные настройки.
                </p>
                <div class="twofa-form">
                    <input type="password" class="twofa-input" id="newPinInput" 
                           placeholder="Введите PIN (4-6 цифр)" maxlength="6" pattern="[0-9]*" inputmode="numeric">
                    <input type="password" class="twofa-input" id="confirmPinInput" 
                           placeholder="Подтвердите PIN" maxlength="6" pattern="[0-9]*" inputmode="numeric">
                    <button class="login-btn" onclick="saveTwoFactorPIN()">Установить PIN</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function saveTwoFactorPIN() {
    const pin1 = document.getElementById('newPinInput').value;
    const pin2 = document.getElementById('confirmPinInput').value;
    
    if (!pin1 || !pin2) {
        showError('Введите оба PIN-кода');
        return;
    }
    
    if (!/^\d{4,6}$/.test(pin1)) {
        showError('PIN должен содержать 4-6 цифр');
        return;
    }
    
    if (pin1 !== pin2) {
        showError('PIN-коды не совпадают');
        return;
    }
    
    setTwoFactorPIN(pin1);
    showNotification('Двухэтапная проверка', 'PIN-код установлен', 'success');
    document.querySelector('.twofa-modal-overlay')?.remove();
}

function verifyTwoFactorPIN(actionName) {
    return new Promise((resolve) => {
        if (!hasTwoFactorPIN()) {
            resolve(true);
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'twofa-verify-modal-overlay';
        modal.innerHTML = `
            <div class="twofa-verify-modal">
                <h2>Подтверждение</h2>
                <p>Для действия "${actionName}" требуется PIN-код</p>
                <input type="password" class="twofa-input" id="verifyPinInput" 
                       placeholder="Введите PIN" maxlength="6" pattern="[0-9]*" inputmode="numeric">
                <div class="twofa-verify-actions">
                    <button class="login-btn" onclick="verifyPinAndContinue('${actionName}', resolve)">Подтвердить</button>
                    <button class="login-btn secondary" onclick="this.closest('.twofa-verify-modal-overlay').remove()">Отмена</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        window.verifyPinAndContinue = (action, callback) => {
            const pin = document.getElementById('verifyPinInput').value;
            if (pin === getTwoFactorPIN()) {
                document.querySelector('.twofa-verify-modal-overlay')?.remove();
                callback(true);
            } else {
                showError('Неверный PIN-код');
            }
        };
    });
}

/* ==========================================================
   3. ЛОГИН ПО QR
   ========================================================== */
function showQRLoginModal() {
    const loginToken = generateQRLoginToken();
    const qrData = JSON.stringify({
        u: username,
        t: loginToken,
        exp: Date.now() + 300000 // 5 минут
    });
    
    const modal = document.createElement('div');
    modal.className = 'qr-login-modal-overlay';
    modal.innerHTML = `
        <div class="qr-login-modal">
            <div class="qr-login-header">
                <h2>Вход по QR</h2>
                <button class="close-btn" onclick="this.closest('.qr-login-modal-overlay').remove()">✕</button>
            </div>
            <div class="qr-login-content">
                <div class="qr-code" id="qrCode"></div>
                <p class="qr-instruction">
                    Отсканируйте QR-код на другом устройстве для быстрого входа
                </p>
                <div class="qr-timer">
                    Действует: <span id="qrTimer">5:00</span>
                </div>
                <button class="login-btn secondary" onclick="refreshQRCode()">Обновить QR</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    generateQRCode(qrData);
    startQRTimer();
}

function generateQRLoginToken() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateQRCode(data) {
    const qrContainer = document.getElementById('qrCode');
    if (!qrContainer) return;
    
    // Используем API для генерации QR
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
    qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR Code" class="qr-image">`;
}

function startQRTimer() {
    const endTime = Date.now() + 300000;
    const timerEl = document.getElementById('qrTimer');
    
    const interval = setInterval(() => {
        const remaining = Math.max(0, endTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        if (timerEl) {
            timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (remaining <= 0) {
            clearInterval(interval);
            showNotification('QR-код', 'QR-код истек, обновите', 'warning');
        }
    }, 1000);
}

function refreshQRCode() {
    document.querySelector('.qr-login-modal-overlay')?.remove();
    showQRLoginModal();
}

function checkQRLogin() {
    // Проверка на наличие QR токена в URL
    const params = new URLSearchParams(window.location.search);
    const qrToken = params.get('qr');
    
    if (qrToken) {
        // Это устройство сканировало QR
        handleQRLogin(qrToken);
    }
}

async function handleQRLogin(token) {
    try {
        const snap = await db.ref(`qr_logins/${token}`).once('value');
        if (snap.exists()) {
            const data = snap.val();
            if (data.exp > Date.now()) {
                // Токен действителен
                localStorage.setItem('ruchat_qr_user', data.username);
                showNotification('Вход', 'Вы успешно вошли через QR', 'success');
                window.location.href = window.location.pathname;
            } else {
                showError('QR-токен истек');
            }
        }
    } catch (e) {
        console.error('Ошибка QR входа:', e);
    }
}

/* ==========================================================
   4. ОБМЕН КОНТАКТАМИ (ВИЗИТКИ)
   ========================================================== */
function showContactCard(usernameToShare) {
    db.ref(`accounts/${usernameToShare}`).once('value', snap => {
        if (!snap.exists()) {
            showError('Пользователь не найден');
            return;
        }
        
        const user = snap.val();
        const modal = document.createElement('div');
        modal.className = 'contact-card-modal-overlay';
        modal.innerHTML = `
            <div class="contact-card-modal">
                <div class="contact-card">
                    <img src="${user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(usernameToShare)}&background=0088cc&color=fff&size=80`}" 
                         alt="Аватар" class="contact-card-avatar">
                    <h3 class="contact-card-name">${user.displayName || usernameToShare}</h3>
                    <div class="contact-card-username">@${usernameToShare}</div>
                    ${user.about ? `<div class="contact-card-about">${user.about}</div>` : ''}
                </div>
                <div class="contact-card-actions">
                    <button class="login-btn" onclick="sendContactToCurrentChat('${usernameToShare}')">
                        Отправить контакт
                    </button>
                    <button class="login-btn secondary" onclick="this.closest('.contact-card-modal-overlay').remove()">
                        Закрыть
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    });
}

function sendContactToCurrentChat(contactUsername) {
    if (!currentChatId || !chatRef) {
        showError('Выберите чат для отправки');
        return;
    }
    
    db.ref(`accounts/${contactUsername}`).once('value', snap => {
        const user = snap.val();
        const contactData = {
            from: username,
            time: Date.now(),
            type: 'contact',
            contact: {
                username: contactUsername,
                displayName: user.displayName || contactUsername,
                avatar: user.avatar || ''
            }
        };
        
        chatRef.push(contactData)
            .then(() => {
                showNotification('Контакт', `Отправлен контакт @${contactUsername}`, 'success');
                document.querySelector('.contact-card-modal-overlay')?.remove();
            })
            .catch(() => {
                showError('Не удалось отправить контакт');
            });
    });
}

function renderContactMessage(contactData) {
    const { username: cUsername, displayName: cName, avatar: cAvatar } = contactData.contact || {};
    const avatarUrl = cAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(cName)}&background=0088cc&color=fff&size=80`;
    
    return `
        <div class="contact-message" onclick="openContactProfile('${cUsername}')">
            <img src="${avatarUrl}" alt="Аватар" class="contact-message-avatar">
            <div class="contact-message-info">
                <div class="contact-message-name">${escapeHtml(cName)}</div>
                <div class="contact-message-username">@${escapeHtml(cUsername)}</div>
            </div>
            <div class="contact-message-action">📇</div>
        </div>
    `;
}

window.openContactProfile = function(contactUsername) {
    showContactCard(contactUsername);
};

/* ==========================================================
   5. ОПРОСЫ (ГОЛОСОВАНИЯ)
   ========================================================== */
function showCreatePollModal() {
    const modal = document.createElement('div');
    modal.className = 'poll-create-modal-overlay';
    modal.innerHTML = `
        <div class="poll-create-modal">
            <div class="poll-create-header">
                <h2>Создать опрос</h2>
                <button class="close-btn" onclick="this.closest('.poll-create-modal-overlay').remove()">✕</button>
            </div>
            <div class="poll-create-body">
                <input type="text" class="poll-input" id="pollQuestion" placeholder="Вопрос" maxlength="256">
                <div class="poll-options" id="pollOptions">
                    <input type="text" class="poll-option-input" placeholder="Вариант 1" maxlength="128">
                    <input type="text" class="poll-option-input" placeholder="Вариант 2" maxlength="128">
                    <input type="text" class="poll-option-input" placeholder="Вариант 3" maxlength="128">
                </div>
                <button class="login-btn secondary" onclick="addPollOption()">+ Добавить вариант</button>
                <label class="poll-checkbox">
                    <input type="checkbox" id="pollMultiple"> Множественный выбор
                </label>
            </div>
            <div class="poll-create-actions">
                <button class="login-btn" onclick="createPoll()">Создать опрос</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function addPollOption() {
    const container = document.getElementById('pollOptions');
    if (!container) return;
    
    const count = container.querySelectorAll('.poll-option-input').length + 1;
    if (count > 10) {
        showNotification('Опросы', 'Максимум 10 вариантов', 'warning');
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'poll-option-input';
    input.placeholder = `Вариант ${count}`;
    input.maxLength = 128;
    container.appendChild(input);
}

function createPoll() {
    const question = document.getElementById('pollQuestion').value.trim();
    const optionInputs = document.querySelectorAll('.poll-option-input');
    const multiple = document.getElementById('pollMultiple').checked;
    
    if (!question) {
        showError('Введите вопрос');
        return;
    }
    
    const options = [];
    optionInputs.forEach(input => {
        const val = input.value.trim();
        if (val) options.push(val);
    });
    
    if (options.length < 2) {
        showError('Минимум 2 варианта ответа');
        return;
    }
    
    const pollData = {
        from: username,
        time: Date.now(),
        type: 'poll',
        poll: {
            question: question,
            options: options.map(opt => ({
                text: opt,
                votes: []
            })),
            multiple: multiple,
            totalVotes: 0
        }
    };
    
    if (!chatRef) {
        showError('Выберите чат');
        return;
    }
    
    chatRef.push(pollData)
        .then(() => {
            showNotification('Опрос', 'Опрос создан', 'success');
            document.querySelector('.poll-create-modal-overlay')?.remove();
        })
        .catch(() => {
            showError('Не удалось создать опрос');
        });
}

function renderPollMessage(pollData, messageId) {
    const { question, options, multiple, totalVotes } = pollData.poll || {};
    
    let optionsHtml = '';
    options.forEach((opt, idx) => {
        const votes = opt.votes?.length || 0;
        const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        const userVoted = opt.votes?.includes(username);
        
        optionsHtml += `
            <div class="poll-option ${userVoted ? 'voted' : ''}" onclick="voteInPoll('${messageId}', ${idx})">
                <div class="poll-option-bar" style="width: ${percent}%"></div>
                <div class="poll-option-content">
                    <span class="poll-option-text">${escapeHtml(opt.text)}</span>
                    <span class="poll-option-percent">${percent}% (${votes})</span>
                </div>
            </div>
        `;
    });
    
    return `
        <div class="poll-message">
            <div class="poll-question">${escapeHtml(question)}</div>
            <div class="poll-options-container">${optionsHtml}</div>
            <div class="poll-footer">
                <span>${totalVotes} голосов</span>
                ${multiple ? '<span>Множественный выбор</span>' : ''}
            </div>
        </div>
    `;
}

async function voteInPoll(messageId, optionIndex) {
    if (!chatRef || !currentChatId) return;
    
    try {
        const snap = await chatRef.child(messageId).once('value');
        const message = snap.val();
        
        if (!message || !message.poll) return;
        
        const poll = message.poll;
        const multiple = poll.multiple;
        
        // Удаляем предыдущие голоса пользователя
        poll.options.forEach(opt => {
            if (opt.votes) {
                opt.votes = opt.votes.filter(v => v !== username);
            }
        });
        
        // Добавляем новый голос
        if (multiple) {
            // Для множественного выбора - переключатель
            if (!poll.options[optionIndex].votes.includes(username)) {
                poll.options[optionIndex].votes.push(username);
            }
        } else {
            // Для одиночного - только один вариант
            poll.options[optionIndex].votes.push(username);
        }
        
        // Считаем общее количество голосов
        const uniqueVoters = new Set();
        poll.options.forEach(opt => {
            opt.votes.forEach(v => uniqueVoters.add(v));
        });
        poll.totalVotes = uniqueVoters.size;
        
        // Обновляем в базе
        await chatRef.child(messageId).update({ poll: poll });
        
    } catch (e) {
        console.error('Ошибка голосования:', e);
        showError('Не удалось проголосовать');
    }
}

/* ==========================================================
   ЭКСПОРТ ФУНКЦИЙ
   ========================================================== */
window.showDeviceSessionsModal = showDeviceSessionsModal;
window.renderSessionsList = renderSessionsList;
window.terminateSession = terminateSession;
window.terminateAllOtherSessions = terminateAllOtherSessions;
window.showTwoFactorSetupModal = showTwoFactorSetupModal;
window.verifyTwoFactorPIN = verifyTwoFactorPIN;
window.showQRLoginModal = showQRLoginModal;
window.showContactCard = showContactCard;
window.sendContactToCurrentChat = sendContactToCurrentChat;
window.showCreatePollModal = showCreatePollModal;
window.addPollOption = addPollOption;
window.voteInPoll = voteInPoll;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    checkQRLogin();
    console.log('[Advanced Features] Загружено');
});
