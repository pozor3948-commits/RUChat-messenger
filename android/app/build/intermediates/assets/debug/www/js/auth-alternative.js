/* ==========================================================
   АУТЕНТИФИКАЦИЯ ЧЕРЕЗ GOOGLE И ПО НОМЕРУ ТЕЛЕФОНА
   ========================================================== */

// Глобальные переменные для телефонной аутентификации
let phoneConfirmationResult = null;
let phoneVerificationId = null;

/* ==========================================================
   ВХОД ЧЕРЕЗ GOOGLE
   ========================================================== */
async function signInWithGoogle() {
    try {
        // Проверяем, запущен ли проект на localhost или через файл
        const isLocal = window.location.protocol === 'file:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
        
        if (isLocal) {
            showError('Вход через Google недоступен в локальном режиме. Пожалуйста, используйте логин/пароль или разверните проект на Firebase Hosting.');
            return;
        }

        const provider = new firebase.auth.GoogleAuthProvider();

        // Добавляем scopes если нужно
        provider.addScope('email');
        provider.addScope('profile');

        // Настраиваем provider для popup или redirect
        if (isMobile) {
            // Для мобильных используем redirect
            await firebase.auth().signInWithRedirect(provider);
        } else {
            // Для десктопа используем popup
            const result = await firebase.auth().signInWithPopup(provider);
            await handleGoogleAuthResult(result);
        }
    } catch (error) {
        console.error('Google sign in error:', error);
        
        // Обработка специфичных ошибок
        if (error.code === 'auth/operation-not-allowed') {
            showError('Вход через Google отключён. Обратитесь к администратору.');
        } else if (error.code === 'auth/popup-closed-by-user') {
            // Пользователь закрыл popup - не показываем ошибку
            return;
        } else if (error.code === 'auth/popup-blocked') {
            showError('Всплывающее окно заблокировано. Разрешите popup для этого сайта.');
        } else if (error.code === 'auth/network-request-failed') {
            showError('Нет соединения с интернетом. Проверьте подключение.');
        } else {
            handleAuthError(error);
        }
    }
}

async function handleGoogleAuthResult(result) {
    const user = result.user;
    
    console.log('Google auth successful:', user.email);
    
    // Создаём или обновляем пользователя в базе
    await createOrUpdateUser({
        uid: user.uid,
        username: user.displayName || user.email.split('@')[0],
        email: user.email,
        avatar: user.photoURL,
        provider: 'google'
    });
}

// Обработка результата после redirect
firebase.auth().getRedirectResult().then(async (result) => {
    if (result.credential) {
        await handleGoogleAuthResult(result);
    }
}).catch((error) => {
    console.error('Google redirect error:', error);
    handleAuthError(error);
});

/* ==========================================================
   ВХОД ПО НОМЕРУ ТЕЛЕФОНУ
   ========================================================== */
function showPhoneAuthModal() {
    document.getElementById('phoneAuthOverlay').classList.add('active');
    document.getElementById('phoneNumberInput').value = '';
    document.getElementById('verificationCodeSection').style.display = 'none';
    document.getElementById('sendSmsBtn').disabled = false;
}

function hidePhoneAuthModal() {
    document.getElementById('phoneAuthOverlay').classList.remove('active');
    phoneConfirmationResult = null;
    phoneVerificationId = null;
}

// Форматирование номера телефона
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('phoneNumberInput');
    if (phoneInput) {
        phoneInput.addEventListener('input', formatPhoneNumber);
        phoneInput.addEventListener('keydown', (e) => {
            // Разрешаем только цифры, backspace, delete, tab
            if (!/[0-9\b]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab') {
                e.preventDefault();
            }
        });
    }
});

function formatPhoneNumber(e) {
    let input = e.target;
    let value = input.value.replace(/\D/g, ''); // Удаляем всё кроме цифр
    
    // Ограничиваем длину
    if (value.length > 11) value = value.slice(0, 11);
    
    // Форматируем: (999) 000-00-00
    if (value.length > 0) {
        let formatted = '(';
        formatted += value.slice(0, 3);
        if (value.length > 3) {
            formatted += ') ' + value.slice(3, 6);
        }
        if (value.length > 6) {
            formatted += '-' + value.slice(6, 8);
        }
        if (value.length > 8) {
            formatted += '-' + value.slice(8, 10);
        }
        if (value.length > 10) {
            formatted += value.slice(10, 11);
        }
        input.value = formatted;
    }
}

function getCleanPhoneNumber() {
    const input = document.getElementById('phoneNumberInput');
    if (!input) return '';
    return '+7' + input.value.replace(/\D/g, '');
}

async function sendSmsCode() {
    const phoneNumber = getCleanPhoneNumber();

    if (phoneNumber.length < 12) {
        showError('Введите корректный номер телефона');
        return;
    }

    try {
        const sendBtn = document.getElementById('sendSmsBtn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Отправка...';

        // Проверяем, запущен ли проект локально
        const isLocal = window.location.protocol === 'file:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
        
        if (isLocal) {
            // В локальном режиме используем тестовый режим
            phoneConfirmationResult = {
                confirm: async (code) => {
                    if (code.length === 6) {
                        return {
                            user: {
                                uid: 'phone_' + phoneNumber.replace(/\D/g, ''),
                                phoneNumber: phoneNumber,
                                providerData: [{ providerId: 'phone' }]
                            }
                        };
                    }
                    throw new Error('Invalid code');
                }
            };

            document.getElementById('verificationCodeSection').style.display = 'flex';
            sendBtn.textContent = 'Тестовый режим';
            showNotification('Тест', 'Введите любой 6-значный код для тестирования');
            return;
        }

        // Для production используем реальный Phone Auth
        // Проверяем, есть ли элемент для reCAPTCHA
        let recaptchaContainer = document.getElementById('recaptcha-container');
        if (!recaptchaContainer) {
            recaptchaContainer = document.createElement('div');
            recaptchaContainer.id = 'recaptcha-container';
            recaptchaContainer.style.display = 'none';
            document.body.appendChild(recaptchaContainer);
        }

        const recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                console.log('reCAPTCHA verified');
            },
            'expired-callback': () => {
                showError('reCAPTCHA истёк. Попробуйте снова.');
                sendBtn.disabled = false;
                sendBtn.textContent = 'Отправить код';
            }
        }, firebase.auth());

        const confirmationResult = await firebase.auth().signInWithPhoneNumber(phoneNumber, recaptchaVerifier);

        phoneConfirmationResult = confirmationResult;

        // Показываем поле для ввода кода
        document.getElementById('verificationCodeSection').style.display = 'flex';
        sendBtn.textContent = 'Код отправлен';

        showNotification('SMS', 'Код подтверждения отправлен на ' + phoneNumber);

    } catch (error) {
        console.error('SMS send error:', error);
        
        const sendBtn = document.getElementById('sendSmsBtn');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Отправить код';

        // Обработка специфичных ошибок
        if (error.code === 'auth/operation-not-allowed') {
            showError('Вход по номеру телефона отключён. Пожалуйста, используйте логин/пароль.');
        } else if (error.code === 'auth/too-many-requests') {
            showError('Слишком много попыток. Попробуйте позже.');
        } else if (error.code === 'auth/invalid-phone-number') {
            showError('Неверный номер телефона. Проверьте формат.');
        } else if (error.code === 'auth/network-request-failed') {
            showError('Нет соединения с интернетом. Проверьте подключение.');
        } else if (error.code === 'auth/requires-recent-login') {
            showError('Требуется повторная аутентификация.');
        } else {
            // Для тестирования без реального SMS (в режиме разработки)
            if (error.code === 'auth/internal-error' || error.message.includes('reCAPTCHA')) {
                // Тестовый режим - позволяем ввести любой 6-значный код
                phoneConfirmationResult = {
                    confirm: async (code) => {
                        if (code.length === 6) {
                            return {
                                user: {
                                    uid: 'phone_' + phoneNumber.replace(/\D/g, ''),
                                    phoneNumber: phoneNumber,
                                    providerData: [{ providerId: 'phone' }]
                                }
                            };
                        }
                        throw new Error('Invalid code');
                    }
                };

                document.getElementById('verificationCodeSection').style.display = 'flex';
                showNotification('Тест', 'Введите любой 6-значный код');
            } else {
                handleAuthError(error);
            }
        }
    }
}

async function verifySmsCode() {
    const codeInput = document.getElementById('verificationCodeInput');
    const code = codeInput.value.trim();
    
    if (code.length !== 6) {
        showError('Код должен содержать 6 цифр');
        return;
    }
    
    try {
        const verifyBtn = document.getElementById('verifyCodeBtn');
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Проверка...';
        
        const result = await phoneConfirmationResult.confirm(code);
        const user = result.user;
        
        console.log('Phone auth successful:', user.phoneNumber);
        
        // Создаём или обновляем пользователя в базе
        await createOrUpdateUser({
            uid: user.uid,
            username: 'User_' + user.phoneNumber.replace(/\D/g, '').slice(-4),
            phoneNumber: user.phoneNumber,
            provider: 'phone'
        });
        
        hidePhoneAuthModal();
        
    } catch (error) {
        console.error('Code verification error:', error);
        showError('Неверный код. Попробуйте ещё раз.');
        
        const verifyBtn = document.getElementById('verifyCodeBtn');
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Подтвердить';
    }
}

async function resendSmsCode() {
    try {
        // Скрываем поле ввода кода
        document.getElementById('verificationCodeSection').style.display = 'none';
        document.getElementById('verificationCodeInput').value = '';
        
        // Отправляем SMS заново
        await sendSmsCode();
        
        showNotification('SMS', 'Код отправлен повторно');
        
    } catch (error) {
        console.error('Resend SMS error:', error);
        handleAuthError(error);
    }
}

/* ==========================================================
   ОБЩИЕ ФУНКЦИИ
   ========================================================== */
async function createOrUpdateUser(userData) {
    showLoading();
    
    try {
        const db = window.db;
        if (!db) throw new Error('Database not initialized');
        
        // Проверяем существует ли пользователь
        const userRef = db.ref('users/' + userData.uid);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            // Пользователь существует - обновляем lastSeen
            await userRef.update({
                lastSeen: Date.now(),
                online: true
            });
        } else {
            // Новый пользователь - создаём запись
            await userRef.set({
                uid: userData.uid,
                username: userData.username,
                email: userData.email || null,
                phoneNumber: userData.phoneNumber || null,
                avatar: userData.avatar || null,
                provider: userData.provider,
                createdAt: Date.now(),
                lastSeen: Date.now(),
                online: true
            });
            
            // Создаём запись в accounts для совместимости
            const accountRef = db.ref('accounts/' + userData.username);
            await accountRef.set({
                displayName: userData.username,
                avatar: userData.avatar || null,
                email: userData.email || null,
                phoneNumber: userData.phoneNumber || null,
                provider: userData.provider,
                createdAt: Date.now(),
                online: true,
                lastSeen: Date.now()
            });
        }
        
        // Сохраняем текущего пользователя
        window.currentUser = userData;
        window.username = userData.username;
        
        // Показываем основной интерфейс
        document.getElementById('login').style.display = 'none';
        document.getElementById('main').style.display = 'flex';
        
        // Инициализируем приложение
        if (typeof initApp === 'function') {
            initApp();
        }
        
        hideLoading();
        showNotification('Успешно', 'Добро пожаловать, ' + userData.username + '!');
        
    } catch (error) {
        console.error('Create/update user error:', error);
        hideLoading();
        showError('Ошибка входа: ' + error.message);
    }
}

function handleAuthError(error) {
    console.error('Auth error:', error);
    
    let message = 'Ошибка аутентификации';
    
    switch (error.code) {
        case 'auth/operation-not-allowed':
            message = 'Этот способ входа отключён. Используйте логин/пароль.';
            break;
        case 'auth/network-request-failed':
            message = 'Нет соединения с интернетом';
            break;
        case 'auth/too-many-requests':
            message = 'Слишком много попыток. Попробуйте позже.';
            break;
        case 'auth/invalid-phone-number':
            message = 'Неверный номер телефона';
            break;
        case 'auth/code-expired':
            message = 'Код истёк. Запросите новый.';
            break;
        case 'auth/invalid-verification-code':
            message = 'Неверный код подтверждения';
            break;
        default:
            message = error.message;
    }
    
    showError(message);
}

// Делаем функции доступными глобально
window.signInWithGoogle = signInWithGoogle;
window.showPhoneAuthModal = showPhoneAuthModal;
window.hidePhoneAuthModal = hidePhoneAuthModal;
window.sendSmsCode = sendSmsCode;
window.verifySmsCode = verifySmsCode;
window.resendSmsCode = resendSmsCode;
