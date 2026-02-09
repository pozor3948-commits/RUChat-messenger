/* ==========================================================
   МЕНЮ НАСТРОЕК
   ========================================================== */

function showSettingsMenu() {
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
                    <div style="color: #a5b4fc; font-size: 14px; margin-bottom: 10px; font-weight: 600;">Информация</div>
                    <div style="color: #cbd5e1; font-size: 14px; line-height: 1.8;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Пользователь:</span>
                            <span style="color: #0088cc;">${window.username || 'Не авторизован'}</span>
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
                    
                    ${window.username ? `
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

    window.toggleThemeFromSettings = function() {
        if (typeof toggleTheme === "function") {
            toggleTheme();
        }
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
}
