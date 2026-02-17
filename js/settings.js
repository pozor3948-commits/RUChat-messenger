/* ==========================================================
   МЕНЮ НАСТРОЕК
   ========================================================== */

function showSettingsMenu() {
    const currentUser = (typeof username !== 'undefined' && username) ? username : (window.username || '');
    const html = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(10px);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        ">
            <div style="
                background: linear-gradient(135deg, #1e2736, #0f172a);
                border-radius: 25px;
                padding: 30px;
                width: 100%;
                max-width: 500px;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 25px 50px rgba(0,0,0,0.5);
                border: 2px solid rgba(255,255,255,0.1);
            ">
                <h2 style="
                    color: white;
                    text-align: center;
                    margin-bottom: 30px;
                    font-size: 24px;
                    background: linear-gradient(45deg, #0088cc, #00b4ff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    font-weight: 800;
                ">Настройки RuChat</h2>
                
                <div style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 15px;
                    padding: 15px;
                    margin-bottom: 20px;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="color: #a5b4fc; font-size: 14px; margin-bottom: 10px; font-weight: 600;">Режим разработки</div>
                    <div style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
                        Приложение запущено локально для разработки<br>
                        Все настройки сохраняются в localStorage
                    </div>
                </div>
                
                <div style="margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                        <span style="color: #e2e8f0; font-size: 16px;">Звуки уведомлений</span>
                        <button onclick="toggleSounds()" style="
                            padding: 8px 16px;
                            background: linear-gradient(45deg, #0088cc, #00b4ff);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-size: 14px;
                            cursor: pointer;
                        ">${localStorage.getItem('soundsEnabled') === 'false' ? 'Включить' : 'Выключить'}</button>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: #e2e8f0; font-size: 16px;">Системные уведомления</span>
                        <button onclick="toggleSystemNotifications()" style="
                            padding: 8px 16px;
                            background: linear-gradient(45deg, #0088cc, #00b4ff);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-size: 14px;
                            cursor: pointer;
                        ">${localStorage.getItem('systemNotifications') === 'false' ? 'Включить' : 'Выключить'}</button>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom: 20px;">
                        <button onclick="requestSystemNotificationsFromSettings()" style="
                            padding: 8px 12px;
                            background: linear-gradient(45deg, #22c55e, #16a34a);
                            color: #0b1f12;
                            border: none;
                            border-radius: 12px;
                            font-size: 14px;
                            cursor: pointer;
                            font-weight: 700;
                        ">Разрешить</button>
                        <button onclick="toggleNotifyOnlyHidden()" style="
                            padding: 8px 12px;
                            background: linear-gradient(45deg, #0ea5e9, #38bdf8);
                            color: #0b1f12;
                            border: none;
                            border-radius: 12px;
                            font-size: 12px;
                            cursor: pointer;
                            font-weight: 700;
                        ">${localStorage.getItem('notifyOnlyHidden') === 'false' ? 'Всегда' : 'Только когда не активна'}</button>
                    </div>

                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 20px;">
                        <span style="color: #e2e8f0; font-size: 16px;">Автовход на этом устройстве</span>
                        <button onclick="toggleAutoLogin()" style="
                            padding: 8px 16px;
                            background: linear-gradient(45deg, #0088cc, #00b4ff);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-size: 14px;
                            cursor: pointer;
                        ">${localStorage.getItem('ruchat_autologin') === 'false' ? 'Включить' : 'Выключить'}</button>
                    </div>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                        <span style="color: #e2e8f0; font-size: 16px;">Темная тема</span>
                        <button onclick="toggleThemeFromSettings()" style="
                            padding: 8px 16px;
                            background: linear-gradient(45deg, #0088cc, #00b4ff);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-size: 14px;
                            cursor: pointer;
                        ">Переключить</button>
                    </div>
                </div>

                <div style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 25px;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="color: #a5b4fc; font-size: 14px; margin-bottom: 10px; font-weight: 600;">Медиа</div>
                    <div style="color: #cbd5e1; font-size: 13px; line-height: 1.6; margin-bottom: 12px;">
                        Автозагрузка в веб-версии управляет автопоказом (тяжелые медиа не будут сразу отображаться).
                    </div>
                    <div style="display:flex; flex-direction:column; gap: 10px;">
                        <div style="display:flex; gap:10px; align-items:center; justify-content:space-between;">
                            <span style="color:#e2e8f0; font-size:14px;">Фото</span>
                            <select id="mediaAutoPhotos" style="
                                padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                                background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                                <option value="always">Всегда</option>
                                <option value="wifi">Только Wi‑Fi</option>
                                <option value="never">Никогда</option>
                            </select>
                        </div>

                        <div style="display:flex; gap:10px; align-items:center; justify-content:space-between;">
                            <span style="color:#e2e8f0; font-size:14px;">Видео</span>
                            <select id="mediaAutoVideos" style="
                                padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                                background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                                <option value="always">Всегда</option>
                                <option value="wifi">Только Wi‑Fi</option>
                                <option value="never">Никогда</option>
                            </select>
                        </div>

                        <div style="display:flex; gap:10px; align-items:center; justify-content:space-between;">
                            <span style="color:#e2e8f0; font-size:14px;">Файлы</span>
                            <select id="mediaAutoFiles" style="
                                padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                                background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                                <option value="always">Всегда</option>
                                <option value="wifi">Только Wi‑Fi</option>
                                <option value="never">Никогда</option>
                            </select>
                        </div>

                        <div style="display:flex; gap:10px; align-items:center;">
                            <input id="mediaLimitMobileMb" type="number" min="0" step="1" placeholder="Лимит моб. (MB)" style="
                                flex:1; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                                background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                            <input id="mediaLimitWifiMb" type="number" min="0" step="1" placeholder="Лимит Wi‑Fi (MB)" style="
                                flex:1; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                                background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                        </div>

                        <div style="display:flex; gap:10px; align-items:center; justify-content:space-between;">
                            <span style="color:#e2e8f0; font-size:14px;">Качество фото</span>
                            <select id="mediaPhotoQuality" style="
                                padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                                background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                                <option value="high">Высокое</option>
                                <option value="medium">Среднее</option>
                                <option value="low">Экономия</option>
                            </select>
                        </div>

                        <div style="display:flex; gap:10px; align-items:center; justify-content:space-between;">
                            <span style="color:#e2e8f0; font-size:14px;">Качество видео</span>
                            <select id="mediaVideoQuality" style="
                                padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                                background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                                <option value="high">Высокое</option>
                                <option value="medium">Среднее</option>
                                <option value="low">Экономия</option>
                            </select>
                        </div>

                        <button onclick="saveMediaSettings()" style="
                            padding: 10px 14px; border-radius: 12px; border: none;
                            background: linear-gradient(45deg, #0088cc, #00b4ff);
                            color: white; font-weight: 700; cursor: pointer;">
                            Сохранить медиа
                        </button>
                    </div>
                </div>
                
                <div style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 25px;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="color: #a5b4fc; font-size: 14px; margin-bottom: 10px; font-weight: 600;">Профиль</div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <input id="profileDisplayName" type="text" placeholder="Имя для отображения" style="
                            padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                            background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                        <input id="profileAvatar" type="text" placeholder="URL аватарки" style="
                            padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                            background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input id="profileAvatarFile" type="file" accept="image/*" style="
                                flex:1; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                                background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                            <button onclick="uploadProfileAvatar()" style="
                                padding: 8px 12px; border-radius: 10px; border: none;
                                background: linear-gradient(45deg, #22c55e, #16a34a);
                                color: #0b1f12; font-weight: 700; cursor: pointer;">
                                Загрузить
                            </button>
                        </div>
                        <textarea id="profileAbout" placeholder="О себе" rows="3" style="
                            padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                            background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none; resize: vertical;"></textarea>
                        <select id="profileLastSeen" style="
                            padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
                            background: rgba(255,255,255,0.08); color: #e2e8f0; outline: none;">
                            <option value="everyone">Показывать статус всем друзьям</option>
                            <option value="nobody">Скрыть статус от всех</option>
                        </select>
                        <button onclick="saveProfileSettings()" style="
                            padding: 10px 14px; border-radius: 12px; border: none;
                            background: linear-gradient(45deg, #0088cc, #00b4ff);
                            color: white; font-weight: 600; cursor: pointer;">
                            Сохранить профиль
                        </button>
                    </div>
                </div>

                <div style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 25px;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="color: #a5b4fc; font-size: 14px; margin-bottom: 10px; font-weight: 600;">Информация</div>
                    <div style="color: #cbd5e1; font-size: 14px; line-height: 1.8;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Пользователь:</span>
                            <span style="color: #0088cc;">${currentUser || 'Не авторизован'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Версия:</span>
                            <span>2.0.0 (разработка)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Соединение:</span>
                            <span style="color: ${navigator.onLine ? '#4ade80' : '#ef4444'}">${navigator.onLine ? 'Активно' : 'Нет соединения'}</span>
                        </div>
                    </div>
                </div>

                ${currentUser ? `
                <div style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 25px;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="color: #f59e0b; font-size: 14px; margin-bottom: 10px; font-weight: 600;">Обслуживание базы</div>
                    <div style="color: #cbd5e1; font-size: 13px; line-height: 1.6; margin-bottom: 12px;">
                        Исправляет «иероглифы» в сообщениях, группах и списках.
                    </div>
                    <button onclick="fixMojibakeFromSettings()" style="
                        width: 100%;
                        padding: 12px 16px;
                        background: linear-gradient(45deg, #f59e0b, #f97316);
                        color: #0f172a;
                        border: none;
                        border-radius: 12px;
                        font-size: 14px;
                        font-weight: 700;
                        cursor: pointer;
                    ">Исправить иероглифы в базе</button>
                </div>
                ` : ''}
                
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="closeSettings()" style="
                        flex: 1;
                        padding: 16px;
                        background: linear-gradient(45deg, #0088cc, #00b4ff);
                        color: white;
                        border: none;
                        border-radius: 15px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Закрыть</button>
                    
                    ${currentUser ? `
                    <button onclick="logoutFromSettings()" style="
                        flex-basis: 100%;
                        padding: 16px;
                        background: linear-gradient(45deg, rgba(239,68,68,0.8), rgba(220,38,38,0.8));
                        color: white;
                        border: none;
                        border-radius: 15px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        margin-top: 10px;
                    ">Выйти из аккаунта</button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = html;
    div.id = 'settingsOverlay';
    document.body.appendChild(div);

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
        } catch (e) {
            // ignore
        }
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
            closeSettings();
        } catch (e) {
            showError('Не удалось сохранить профиль');
        } finally {
            hideLoading();
        }
    };

    window.uploadProfileAvatar = function() {
        const fileInput = document.getElementById('profileAvatarFile');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            showError('Выберите файл');
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target.result;
            const avatarInput = document.getElementById('profileAvatar');
            if (avatarInput) avatarInput.value = dataUrl;
            if (typeof window.saveProfileSettings === 'function') {
                await window.saveProfileSettings();
            }
        };
        reader.readAsDataURL(file);
    };
    
    window.closeSettings = function() {
        const overlay = document.getElementById('settingsOverlay');
        if (overlay) overlay.remove();
    };
    
    window.toggleSounds = function() {
        const current = localStorage.getItem('soundsEnabled');
        const newValue = current === 'false' ? 'true' : 'false';
        localStorage.setItem('soundsEnabled', newValue);
        
        if (window.soundConfig) {
            window.soundConfig.enabled = newValue === 'true';
        }
        
        showNotification('Звуки', newValue === 'true' ? 'Звуки включены' : 'Звуки выключены', 'info');
        closeSettings();
    };

    window.toggleSystemNotifications = function() {
        const current = localStorage.getItem('systemNotifications');
        const newValue = current === 'false' ? 'true' : 'false';
        localStorage.setItem('systemNotifications', newValue);
        showNotification('Уведомления', newValue === 'true' ? 'Системные уведомления включены' : 'Системные уведомления выключены', 'info');
        closeSettings();
    };

    window.toggleNotifyOnlyHidden = function() {
        const current = localStorage.getItem('notifyOnlyHidden');
        const newValue = current === 'false' ? 'true' : 'false';
        localStorage.setItem('notifyOnlyHidden', newValue);
        showNotification('Уведомления', newValue === 'true' ? 'Только когда вкладка не активна' : 'Всегда показывать', 'info');
        closeSettings();
    };

    window.toggleAutoLogin = function() {
        const current = localStorage.getItem('ruchat_autologin');
        const newValue = current === 'false' ? 'true' : 'false';
        localStorage.setItem('ruchat_autologin', newValue);
        if (newValue === 'false' && typeof unregisterDeviceToken === 'function') {
            unregisterDeviceToken(window.username || username);
        }
        showNotification('Автовход', newValue === 'true' ? 'Автовход включен' : 'Автовход выключен', 'info');
        closeSettings();
    };

    window.requestSystemNotificationsFromSettings = async function() {
        if (typeof requestSystemNotifications === 'function') {
            await requestSystemNotifications();
        } else {
            showError('Функция уведомлений недоступна');
        }
        closeSettings();
    };

    window.toggleThemeFromSettings = function() {
        if (typeof toggleTheme === "function") {
            toggleTheme();
        }
        closeSettings();
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

        if (typeof applyVideoQualityFromSettings === 'function') {
            applyVideoQualityFromSettings();
        }

        showNotification('Медиа', 'Настройки сохранены', 'success');
        closeSettings();
    };
    
    window.logoutFromSettings = function() {
        if (confirm('Вы уверены, что хотите выйти из аккаунта?')) {
            if (typeof logout === 'function') {
                logout();
            }
            closeSettings();
        }
    };

    window.fixMojibakeFromSettings = function() {
        closeSettings();
        if (typeof runMojibakeMigration === 'function') {
            runMojibakeMigration();
        } else {
            showError('Миграция недоступна');
        }
    };
    
    div.addEventListener('click', function(e) {
        if (e.target === this) {
            closeSettings();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeSettings();
        }
    });

    if (typeof window.loadProfileSettings === 'function') {
        window.loadProfileSettings();
    }
    if (typeof window.loadMediaSettings === 'function') {
        window.loadMediaSettings();
    }
}
