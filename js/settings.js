/* ==========================================================
   НАСТРОЙКИ (Drawer как на референсе)
   ========================================================== */

function showSettingsMenu() {
    const existing = document.getElementById('settingsOverlay');
    if (existing) existing.remove();

    const currentUser = (typeof username !== 'undefined' && username) ? username : (window.username || '');
    const isMobileNow = window.innerWidth <= 768;

    const getAvatarUrl = () => {
        const avatarEl = document.getElementById('userAvatar');
        const src = avatarEl && avatarEl.getAttribute('src') ? avatarEl.getAttribute('src') : '';
        if (src && (!window.isValidMediaUrl || window.isValidMediaUrl(src))) return src;
        if (!currentUser) return '';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser)}&background=0088cc&color=fff&size=128`;
    };

    const getDisplayName = () => {
        try {
            const profile = window.myProfile || {};
            const name = profile.displayName || currentUser || 'Гость';
            return (typeof normalizeText === 'function') ? normalizeText(name) : name;
        } catch {
            return currentUser || 'Гость';
        }
    };

    const overlay = document.createElement('div');
    overlay.id = 'settingsOverlay';
    overlay.className = `settings-overlay${isMobileNow ? ' mobile' : ''}`;

    overlay.innerHTML = `
        <aside class="settings-drawer" role="dialog" aria-modal="true" aria-label="Настройки">
            <div class="settings-drawer-header">
                <img class="settings-drawer-avatar" id="settingsDrawerAvatar" alt="avatar">
                <div class="settings-drawer-user">
                    <div class="settings-drawer-name" id="settingsDrawerName"></div>
                    <div class="settings-drawer-sub" id="settingsDrawerSub">${currentUser ? 'Аккаунт подключён' : 'Войдите, чтобы сохранить профиль'}</div>
                </div>
            </div>

            <div class="settings-nav" role="navigation" aria-label="Разделы">
                <button class="settings-nav-item active" data-section="main" data-title="Главное" type="button">
                    <span class="settings-nav-icon">🏠</span>
                    <span class="settings-nav-label">Главное</span>
                    <span class="settings-nav-chevron">›</span>
                </button>
                <button class="settings-nav-item" data-section="profile" data-title="Профиль" type="button" ${currentUser ? '' : 'disabled'}>
                    <span class="settings-nav-icon">👤</span>
                    <span class="settings-nav-label">Профиль</span>
                    <span class="settings-nav-chevron">›</span>
                </button>
                <button class="settings-nav-item" data-section="media" data-title="Медиа" type="button">
                    <span class="settings-nav-icon">📷</span>
                    <span class="settings-nav-label">Медиа</span>
                    <span class="settings-nav-chevron">›</span>
                </button>
                <button class="settings-nav-item" data-section="notify" data-title="Уведомления" type="button">
                    <span class="settings-nav-icon">🔔</span>
                    <span class="settings-nav-label">Уведомления</span>
                    <span class="settings-nav-chevron">›</span>
                </button>
                <button class="settings-nav-item" data-section="theme" data-title="Тема" type="button">
                    <span class="settings-nav-icon">🌓</span>
                    <span class="settings-nav-label">Тема</span>
                    <span class="settings-nav-chevron">›</span>
                </button>
                <button class="settings-nav-item" data-section="db" data-title="База" type="button" ${currentUser ? '' : 'disabled'}>
                    <span class="settings-nav-icon">🧹</span>
                    <span class="settings-nav-label">Исправить базу</span>
                    <span class="settings-nav-chevron">›</span>
                </button>

                <div class="settings-nav-sep"></div>

                <button class="settings-nav-item ${currentUser ? '' : 'muted'}" data-section="account" data-title="Аккаунт" type="button">
                    <span class="settings-nav-icon">⚙️</span>
                    <span class="settings-nav-label">Аккаунт</span>
                    <span class="settings-nav-chevron">›</span>
                </button>
                <button class="settings-nav-item danger" id="settingsLogoutBtn" type="button" ${currentUser ? '' : 'disabled'}>
                    <span class="settings-nav-icon">⎋</span>
                    <span class="settings-nav-label">Выйти</span>
                    <span class="settings-nav-chevron">›</span>
                </button>
            </div>

            <div class="settings-drawer-footer">
                <button class="settings-drawer-close" type="button" id="settingsDrawerCloseBtn">Закрыть</button>
            </div>
        </aside>

        <section class="settings-panel" aria-label="Параметры">
            <div class="settings-panel-header">
                <button class="settings-panel-btn settings-panel-back" type="button" id="settingsBackBtn" title="Назад">←</button>
                <div class="settings-panel-title" id="settingsPanelTitle">Главное</div>
                <div class="settings-panel-actions">
                    <button class="settings-panel-btn" type="button" id="settingsCloseBtn" title="Закрыть">✕</button>
                </div>
            </div>

            <div class="settings-panel-body">
                <div class="settings-section active" id="settingsSection_main">
                    <div class="settings-card">
                        <div class="settings-card-title">Информация</div>
                        <div class="settings-kv">
                            <div class="settings-k">Пользователь</div>
                            <div class="settings-v" id="settingsInfoUser">${currentUser ? currentUser : 'Не авторизован'}</div>
                        </div>
                        <div class="settings-kv">
                            <div class="settings-k">Версия</div>
                        <div class="settings-v">Build 2026-02-19d</div>
                        </div>
                        <div class="settings-kv">
                            <div class="settings-k">Соединение</div>
                            <div class="settings-v" id="settingsInfoConn">${navigator.onLine ? 'Интернет есть' : 'Нет интернета'}</div>
                        </div>
                    </div>

                    <div class="settings-card">
                        <div class="settings-card-title">Быстрые переключатели</div>
                        <div class="settings-row">
                            <div class="settings-row-text">
                                <div class="settings-row-title">Звуки</div>
                                <div class="settings-row-sub">Звук отправки/получения</div>
                            </div>
                            <button class="settings-btn small" type="button" id="settingsSoundsBtn"></button>
                        </div>
                        <div class="settings-row">
                            <div class="settings-row-text">
                                <div class="settings-row-title">Автовход</div>
                                <div class="settings-row-sub">Запоминать устройство</div>
                            </div>
                            <button class="settings-btn small" type="button" id="settingsAutoLoginBtn"></button>
                        </div>
                    </div>
                </div>

                <div class="settings-section" id="settingsSection_profile">
                    <div class="settings-card">
                        <div class="settings-card-title">Профиль</div>
                        <label class="settings-label">Имя</label>
                        <input id="profileDisplayName" class="settings-input" type="text" placeholder="Имя для отображения">

                        <label class="settings-label">Аватар (URL или загрузка)</label>
                        <input id="profileAvatar" class="settings-input" type="text" placeholder="URL аватарки">
                        <div class="settings-file-row">
                            <input id="profileAvatarFile" class="settings-input file" type="file" accept="image/*">
                            <button class="settings-btn secondary" type="button" id="profileUploadBtn">Загрузить</button>
                        </div>

                        <label class="settings-label">О себе</label>
                        <textarea id="profileAbout" class="settings-textarea" rows="3" placeholder="О себе"></textarea>

                        <label class="settings-label">Статус</label>
                        <select id="profileLastSeen" class="settings-select">
                            <option value="everyone">Показывать статус всем друзьям</option>
                            <option value="nobody">Скрыть статус от всех</option>
                        </select>

                        <button class="settings-btn primary" type="button" id="profileSaveBtn">Сохранить профиль</button>
                    </div>
                </div>

                <div class="settings-section" id="settingsSection_media">
                    <div class="settings-card">
                        <div class="settings-card-title">Автоскачивание</div>
                        <label class="settings-label">Фото</label>
                        <select id="mediaAutoPhotos" class="settings-select">
                            <option value="always">Всегда</option>
                            <option value="wifi">Только Wi‑Fi</option>
                            <option value="never">Никогда</option>
                        </select>

                        <label class="settings-label">Видео</label>
                        <select id="mediaAutoVideos" class="settings-select">
                            <option value="always">Всегда</option>
                            <option value="wifi">Только Wi‑Fi</option>
                            <option value="never">Никогда</option>
                        </select>

                        <label class="settings-label">Файлы</label>
                        <select id="mediaAutoFiles" class="settings-select">
                            <option value="always">Всегда</option>
                            <option value="wifi">Только Wi‑Fi</option>
                            <option value="never">Никогда</option>
                        </select>
                    </div>

                    <div class="settings-card">
                        <div class="settings-card-title">Лимиты</div>
                        <div class="settings-2col">
                            <div>
                                <label class="settings-label">Мобильная сеть (MB)</label>
                                <input id="mediaLimitMobileMb" class="settings-input" type="number" min="0" step="1">
                            </div>
                            <div>
                                <label class="settings-label">Wi‑Fi (MB)</label>
                                <input id="mediaLimitWifiMb" class="settings-input" type="number" min="0" step="1">
                            </div>
                        </div>
                    </div>

                    <div class="settings-card">
                        <div class="settings-card-title">Качество</div>
                        <label class="settings-label">Фото</label>
                        <select id="mediaPhotoQuality" class="settings-select">
                            <option value="high">Высокое</option>
                            <option value="medium">Среднее</option>
                            <option value="low">Экономия</option>
                        </select>

                        <label class="settings-label">Видео</label>
                        <select id="mediaVideoQuality" class="settings-select">
                            <option value="high">Высокое</option>
                            <option value="medium">Среднее</option>
                            <option value="low">Экономия</option>
                        </select>

                        <button class="settings-btn primary" type="button" id="mediaSaveBtn">Сохранить медиа</button>
                    </div>
                </div>

                <div class="settings-section" id="settingsSection_notify">
                    <div class="settings-card">
                        <div class="settings-card-title">Уведомления</div>
                        <div class="settings-row">
                            <div class="settings-row-text">
                                <div class="settings-row-title">Системные уведомления</div>
                                <div class="settings-row-sub">Push/OS уведомления (если браузер разрешит)</div>
                            </div>
                            <button class="settings-btn small" type="button" id="settingsSystemNotifBtn"></button>
                        </div>
                        <div class="settings-row">
                            <div class="settings-row-text">
                                <div class="settings-row-title">Только когда вкладка не активна</div>
                                <div class="settings-row-sub">Не спамим, если ты в чате</div>
                            </div>
                            <button class="settings-btn small" type="button" id="settingsOnlyHiddenBtn"></button>
                        </div>
                        <div class="settings-row">
                            <div class="settings-row-text">
                                <div class="settings-row-title">Разрешение</div>
                                <div class="settings-row-sub">Запросить у браузера доступ</div>
                            </div>
                            <button class="settings-btn secondary small" type="button" id="settingsAskPermBtn">Запросить</button>
                        </div>
                    </div>
                </div>

                <div class="settings-section" id="settingsSection_theme">
                    <div class="settings-card">
                        <div class="settings-card-title">Тема</div>
                        <div class="settings-row">
                            <div class="settings-row-text">
                                <div class="settings-row-title">Светлая / Тёмная</div>
                                <div class="settings-row-sub">Переключить оформление</div>
                            </div>
                            <button class="settings-btn primary small" type="button" id="settingsThemeBtn">Переключить</button>
                        </div>
                    </div>
                </div>

                <div class="settings-section" id="settingsSection_db">
                    <div class="settings-card">
                        <div class="settings-card-title">Обслуживание</div>
                        <div class="settings-note">
                            Исправляет «иероглифы» в сообщениях, группах и списках (один раз).
                        </div>
                        <button class="settings-btn warn" type="button" id="settingsFixDbBtn">Исправить базу</button>
                    </div>
                </div>

                <div class="settings-section" id="settingsSection_account">
                    <div class="settings-card">
                        <div class="settings-card-title">Аккаунт</div>
                        <div class="settings-row">
                            <div class="settings-row-text">
                                <div class="settings-row-title">Автовход</div>
                                <div class="settings-row-sub">Отключи, если это чужой телефон</div>
                            </div>
                            <button class="settings-btn small" type="button" id="settingsAutoLoginBtn2"></button>
                        </div>
                        <div class="settings-row">
                            <div class="settings-row-text">
                                <div class="settings-row-title">Выйти</div>
                                <div class="settings-row-sub">Завершить сессию</div>
                            </div>
                            <button class="settings-btn danger small" type="button" id="settingsLogoutBtn2">Выйти</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;

    document.body.appendChild(overlay);

    const avatar = document.getElementById('settingsDrawerAvatar');
    if (avatar) avatar.src = getAvatarUrl();
    const nm = document.getElementById('settingsDrawerName');
    if (nm) nm.textContent = getDisplayName();
    let updateThemeButtons = () => {};

    const initThemeSettingsUI = () => {
        const themeSection = document.getElementById('settingsSection_theme');
        if (!themeSection) return;

        const themes = [
            { id: 'dark', label: 'Тёмная' },
            { id: 'light', label: 'Светлая' },
            { id: 'blue', label: 'Голубая' },
            { id: 'pink', label: 'Розовая' },
            { id: 'black', label: 'Чёрная' },
            { id: 'green', label: 'Зелёная' },
            { id: 'purple', label: 'Фиолетовая' }
        ];

        themeSection.innerHTML = `
            <div class="settings-card">
                <div class="settings-card-title">Тема</div>
                <div class="settings-theme-grid">
                    ${themes.map(theme => `
                        <button class="settings-theme-option" type="button" data-theme="${theme.id}">
                            <span class="settings-theme-swatch" aria-hidden="true"></span>
                            <span class="settings-theme-label">${theme.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        updateThemeButtons = () => {
            const currentTheme = (typeof window.getCurrentTheme === 'function')
                ? String(window.getCurrentTheme())
                : String(localStorage.getItem('ruchat_theme') || 'dark');
            themeSection.querySelectorAll('.settings-theme-option').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === currentTheme);
            });
        };

        themeSection.querySelectorAll('.settings-theme-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme || 'dark';
                if (typeof window.setTheme === 'function') {
                    window.setTheme(theme);
                } else {
                    localStorage.setItem('ruchat_theme', theme);
                }
                updateThemeButtons();
            });
        });

        updateThemeButtons();
    };

    const renderDynamic = () => {
        const soundsOn = localStorage.getItem('soundsEnabled') !== 'false';
        const sysOn = localStorage.getItem('systemNotifications') !== 'false';
        const onlyHidden = localStorage.getItem('notifyOnlyHidden') !== 'false';
        const autoLogin = localStorage.getItem('ruchat_autologin') !== 'false';

        const setBtn = (id, text, on) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = text;
            el.classList.toggle('on', !!on);
            el.classList.toggle('off', !on);
        };

        setBtn('settingsSoundsBtn', soundsOn ? 'Вкл' : 'Выкл', soundsOn);
        setBtn('settingsSystemNotifBtn', sysOn ? 'Вкл' : 'Выкл', sysOn);
        setBtn('settingsOnlyHiddenBtn', onlyHidden ? 'Да' : 'Нет', onlyHidden);
        setBtn('settingsAutoLoginBtn', autoLogin ? 'Вкл' : 'Выкл', autoLogin);
        setBtn('settingsAutoLoginBtn2', autoLogin ? 'Вкл' : 'Выкл', autoLogin);

        const conn = document.getElementById('settingsInfoConn');
        if (conn) conn.textContent = (window.firebaseConnected === false) ? 'Firebase: нет соединения' : (navigator.onLine ? 'Интернет есть' : 'Нет интернета');
        updateThemeButtons();
    };

    const setPanelTitle = (title) => {
        const el = document.getElementById('settingsPanelTitle');
        if (el) el.textContent = title || 'Настройки';
    };

    const selectSection = (section, title) => {
        document.querySelectorAll('#settingsOverlay .settings-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });
        document.querySelectorAll('#settingsOverlay .settings-section').forEach(sec => {
            sec.classList.toggle('active', sec.id === `settingsSection_${section}`);
        });
        setPanelTitle(title);

        if (isMobileNow) overlay.classList.add('panel-active');
        renderDynamic();
    };

    // Навигация
    overlay.querySelectorAll('.settings-nav-item[data-section]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            selectSection(btn.dataset.section, btn.dataset.title || btn.textContent.trim());
        });
    });

    // Mobile: back
    const backBtn = document.getElementById('settingsBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => overlay.classList.remove('panel-active'));
    }

    // Close buttons
    const closeBtn = document.getElementById('settingsCloseBtn');
    const drawerCloseBtn = document.getElementById('settingsDrawerCloseBtn');
    const closeSettings = () => {
        const el = document.getElementById('settingsOverlay');
        if (el) el.remove();
    };
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeSettings);

    // Logout buttons
    const doLogout = () => {
        if (!currentUser) return;
        if (!confirm('Выйти из аккаунта?')) return;
        try {
            if (typeof logout === 'function') logout();
        } finally {
            closeSettings();
        }
    };
    const logoutBtn = document.getElementById('settingsLogoutBtn');
    const logoutBtn2 = document.getElementById('settingsLogoutBtn2');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    if (logoutBtn2) logoutBtn2.addEventListener('click', doLogout);

    // Глобальные функции (совместимость со старым кодом)
    window.closeSettings = closeSettings;

    window.toggleSounds = function() {
        const current = localStorage.getItem('soundsEnabled');
        const newValue = current === 'false' ? 'true' : 'false';
        localStorage.setItem('soundsEnabled', newValue);
        if (window.soundConfig) window.soundConfig.enabled = newValue === 'true';
        showNotification('Звуки', newValue === 'true' ? 'Звуки включены' : 'Звуки выключены', 'info');
        renderDynamic();
    };

    window.toggleSystemNotifications = async function() {
        const current = localStorage.getItem('systemNotifications');
        const newValue = current === 'false' ? 'true' : 'false';
        localStorage.setItem('systemNotifications', newValue);
        if (newValue === 'true') {
            if (typeof window.syncPushTokenForCurrentSession === 'function') {
                await window.syncPushTokenForCurrentSession({
                    askPermission: ('Notification' in window && Notification.permission === 'default')
                });
            }
        } else if (typeof window.removePushTokenForCurrentSession === 'function') {
            await window.removePushTokenForCurrentSession();
        }
        showNotification('Уведомления', newValue === 'true' ? 'Включены' : 'Выключены', 'info');
        renderDynamic();
    };

    window.toggleNotifyOnlyHidden = function() {
        const current = localStorage.getItem('notifyOnlyHidden');
        const newValue = current === 'false' ? 'true' : 'false';
        localStorage.setItem('notifyOnlyHidden', newValue);
        showNotification('Уведомления', newValue === 'true' ? 'Только когда вкладка не активна' : 'Всегда показывать', 'info');
        renderDynamic();
    };

    window.toggleAutoLogin = function() {
        const current = localStorage.getItem('ruchat_autologin');
        const newValue = current === 'false' ? 'true' : 'false';
        localStorage.setItem('ruchat_autologin', newValue);
        if (newValue === 'false' && typeof unregisterDeviceToken === 'function') {
            unregisterDeviceToken((typeof username !== 'undefined' && username) ? username : (window.username || ''));
        }
        showNotification('Автовход', newValue === 'true' ? 'Автовход включен' : 'Автовход выключен', 'info');
        renderDynamic();
    };

    window.requestSystemNotificationsFromSettings = async function() {
        if (typeof requestSystemNotifications === 'function') {
            await requestSystemNotifications();
        } else {
            showError('Функция уведомлений недоступна');
        }
        renderDynamic();
    };

    window.toggleThemeFromSettings = function() {
        if (typeof toggleTheme === 'function') toggleTheme();
        updateThemeButtons();
        renderDynamic();
    };

    window.loadMediaSettings = function() {
        const setVal = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };
        const setNum = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = String(value);
        };
        setVal('mediaAutoPhotos', localStorage.getItem('ruchat_media_auto_photos') || 'always');
        setVal('mediaAutoVideos', localStorage.getItem('ruchat_media_auto_videos') || 'wifi');
        setVal('mediaAutoFiles', localStorage.getItem('ruchat_media_auto_files') || 'wifi');
        setNum('mediaLimitMobileMb', localStorage.getItem('ruchat_media_limit_mobile_mb') || 10);
        setNum('mediaLimitWifiMb', localStorage.getItem('ruchat_media_limit_wifi_mb') || 25);
        setVal('mediaPhotoQuality', localStorage.getItem('ruchat_media_photo_quality') || 'medium');
        setVal('mediaVideoQuality', localStorage.getItem('ruchat_media_video_quality') || 'medium');
    };

    window.saveMediaSettings = function() {
        const readVal = (id, def) => {
            const el = document.getElementById(id);
            const v = el ? String(el.value || '') : '';
            return v || def;
        };
        const readNum = (id, def) => {
            const el = document.getElementById(id);
            const v = el ? Number(el.value) : Number(def);
            if (!Number.isFinite(v)) return def;
            return Math.max(0, Math.floor(v));
        };

        localStorage.setItem('ruchat_media_auto_photos', readVal('mediaAutoPhotos', 'always'));
        localStorage.setItem('ruchat_media_auto_videos', readVal('mediaAutoVideos', 'wifi'));
        localStorage.setItem('ruchat_media_auto_files', readVal('mediaAutoFiles', 'wifi'));
        localStorage.setItem('ruchat_media_limit_mobile_mb', String(readNum('mediaLimitMobileMb', 10)));
        localStorage.setItem('ruchat_media_limit_wifi_mb', String(readNum('mediaLimitWifiMb', 25)));
        localStorage.setItem('ruchat_media_photo_quality', readVal('mediaPhotoQuality', 'medium'));
        localStorage.setItem('ruchat_media_video_quality', readVal('mediaVideoQuality', 'medium'));

        if (typeof applyVideoQualityFromSettings === 'function') applyVideoQualityFromSettings();
        showNotification('Медиа', 'Настройки сохранены', 'success');
    };

    window.loadProfileSettings = async function() {
        const user = (typeof username !== 'undefined' && username) ? username : (window.username || '');
        if (!user) return;
        try {
            const database = window.db || (typeof db !== 'undefined' ? db : null);
            if (!database) return;
            const snap = await database.ref("accounts/" + user).get();
            if (!snap.exists()) return;
            const data = snap.val() || {};
            const dn = typeof normalizeText === 'function' ? normalizeText(data.displayName || user) : (data.displayName || user);
            const about = typeof normalizeText === 'function' ? normalizeText(data.about || '') : (data.about || '');
            const displayInput = document.getElementById('profileDisplayName');
            const avatarInput = document.getElementById('profileAvatar');
            const aboutInput = document.getElementById('profileAbout');
            const lastSeenInput = document.getElementById('profileLastSeen');
            if (displayInput) displayInput.value = dn;
            if (avatarInput) avatarInput.value = data.avatar || '';
            if (aboutInput) aboutInput.value = about;
            if (lastSeenInput) {
                const privacy = data.privacy || {};
                lastSeenInput.value = privacy.showLastSeen || 'everyone';
            }
        } catch {
            // ignore
        }
    };

    window.saveProfileSettings = async function() {
        const user = (typeof username !== 'undefined' && username) ? username : (window.username || '');
        if (!user) { showError('Пользователь не найден'); return; }
        const database = window.db || (typeof db !== 'undefined' ? db : null);
        if (!database) { showError('База не инициализирована'); return; }
        const displayInput = document.getElementById('profileDisplayName');
        const avatarInput = document.getElementById('profileAvatar');
        const aboutInput = document.getElementById('profileAbout');
        const lastSeenInput = document.getElementById('profileLastSeen');
        const displayName = displayInput ? displayInput.value.trim() : '';
        const avatar = avatarInput ? avatarInput.value.trim() : '';
        const about = aboutInput ? aboutInput.value.trim() : '';
        const lastSeen = lastSeenInput ? lastSeenInput.value : 'everyone';
        const finalName = displayName.length ? displayName : user;
        if (finalName.length < 2) { showError('Имя должно быть минимум 2 символа'); return; }
        if (avatar && (typeof isValidMediaUrl === 'function') && !isValidMediaUrl(avatar)) { showError('Неверный URL аватарки'); return; }
        try {
            showLoading();
            await database.ref("accounts/" + user).update({
                displayName: finalName,
                about: about,
                avatar: avatar,
                privacy: {
                    showLastSeen: lastSeen === 'nobody' ? 'nobody' : 'everyone'
                }
            });
            showNotification('Профиль', 'Профиль обновлен', 'success');
            const nameEl = document.getElementById('settingsDrawerName');
            if (nameEl) nameEl.textContent = finalName;
        } catch {
            showError('Не удалось сохранить профиль');
        } finally {
            hideLoading();
        }
    };

    window.uploadProfileAvatar = function() {
        const fileInput = document.getElementById('profileAvatarFile');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) { showError('Выберите файл'); return; }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target && e.target.result ? String(e.target.result) : '';
            const avatarInput = document.getElementById('profileAvatar');
            if (avatarInput) avatarInput.value = dataUrl;
            const drawerAvatar = document.getElementById('settingsDrawerAvatar');
            if (drawerAvatar) drawerAvatar.src = dataUrl;
            await window.saveProfileSettings();
        };
        reader.readAsDataURL(file);
    };

    window.fixMojibakeFromSettings = function() {
        if (typeof runMojibakeMigration === 'function') {
            runMojibakeMigration();
        } else {
            showError('Миграция недоступна');
        }
    };

    // Bind UI buttons
    const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    };
    bind('settingsSoundsBtn', window.toggleSounds);
    bind('settingsAutoLoginBtn', window.toggleAutoLogin);
    bind('settingsAutoLoginBtn2', window.toggleAutoLogin);
    bind('settingsSystemNotifBtn', window.toggleSystemNotifications);
    bind('settingsOnlyHiddenBtn', window.toggleNotifyOnlyHidden);
    bind('settingsAskPermBtn', window.requestSystemNotificationsFromSettings);
    bind('mediaSaveBtn', window.saveMediaSettings);
    bind('profileSaveBtn', window.saveProfileSettings);
    bind('profileUploadBtn', window.uploadProfileAvatar);
    bind('settingsFixDbBtn', window.fixMojibakeFromSettings);

    // Close on background click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSettings();
    });
    // Escape
    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeSettings();
            document.removeEventListener('keydown', onKeyDown);
        }
    };
    document.addEventListener('keydown', onKeyDown);

    // Load initial values
    initThemeSettingsUI();
    if (typeof window.loadProfileSettings === 'function') window.loadProfileSettings();
    if (typeof window.loadMediaSettings === 'function') window.loadMediaSettings();
    renderDynamic();
}
