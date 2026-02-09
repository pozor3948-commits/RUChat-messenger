/* ==========================================================
   РњР•РќР® РќРђРЎРўР РћР•Рљ Р”Р›РЇ Р РђР—Р РђР‘РћРўРљР
   ========================================================== */

// РџРѕРєР°Р· РјРµРЅСЋ РЅР°СЃС‚СЂРѕРµРє РїСЂРё РєР»РёРєРµ РЅР° РєРЅРѕРїРєСѓ вљ™пёЏ
function showSettingsMenu() {
    // РЎРѕР·РґР°РµРј РїСЂРѕСЃС‚РѕРµ РјРµРЅСЋ РЅР°СЃС‚СЂРѕРµРє
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
                ">вљ™пёЏ РќР°СЃС‚СЂРѕР№РєРё RuChat</h2>
                
                <div style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 15px;
                    padding: 15px;
                    margin-bottom: 20px;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="color: #a5b4fc; font-size: 14px; margin-bottom: 10px; font-weight: 600;">рџ’» Р РµР¶РёРј СЂР°Р·СЂР°Р±РѕС‚РєРё</div>
                    <div style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
                        РџСЂРёР»РѕР¶РµРЅРёРµ Р·Р°РїСѓС‰РµРЅРѕ Р»РѕРєР°Р»СЊРЅРѕ РґР»СЏ СЂР°Р·СЂР°Р±РѕС‚РєРё<br>
                        Р’СЃРµ РЅР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ localStorage
                    </div>
                </div>
                
                <div style="margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                        <span style="color: #e2e8f0; font-size: 16px;">рџ”Љ Р—РІСѓРєРё СѓРІРµРґРѕРјР»РµРЅРёР№</span>
                        <button onclick="toggleSounds()" style="
                            padding: 8px 16px;
                            background: linear-gradient(45deg, #0088cc, #00b4ff);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-size: 14px;
                            cursor: pointer;
                        ">${localStorage.getItem('soundsEnabled') === 'false' ? 'Р’РєР»СЋС‡РёС‚СЊ' : 'Р’С‹РєР»СЋС‡РёС‚СЊ'}</button>
                    </div>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                        <span style="color: #e2e8f0; font-size: 16px;">рџЊ™ РўС‘РјРЅР°СЏ С‚РµРјР°</span>
                        <button onclick="toggleThemeFromSettings()" style="
                            padding: 8px 16px;
                            background: linear-gradient(45deg, #0088cc, #00b4ff);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-size: 14px;
                            cursor: pointer;
                        ">РџРµСЂРµРєР»СЋС‡РёС‚СЊ</button>
                    </div>
                </div>
                
                <div style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 25px;
                    border: 1px solid rgba(255,255,255,0.1);
                ">
                    <div style="color: #a5b4fc; font-size: 14px; margin-bottom: 10px; font-weight: 600;">РРЅС„РѕСЂРјР°С†РёСЏ</div>
                    <div style="color: #cbd5e1; font-size: 14px; line-height: 1.8;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ:</span>
                            <span style="color: #0088cc;">${window.username || 'РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Р’РµСЂСЃРёСЏ:</span>
                            <span>2.0.0 (СЂР°Р·СЂР°Р±РѕС‚РєР°)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>РЎРѕРµРґРёРЅРµРЅРёРµ:</span>
                            <span style="color: ${navigator.onLine ? '#4ade80' : '#ef4444'}">${navigator.onLine ? 'вњ… РђРєС‚РёРІРЅРѕ' : 'вќЊ РќРµС‚ СЃРѕРµРґРёРЅРµРЅРёСЏ'}</span>
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
                    ">вњ• Р—Р°РєСЂС‹С‚СЊ</button>
                    
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
                    ">рџљЄ Р’С‹Р№С‚Рё РёР· Р°РєРєР°СѓРЅС‚Р°</button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = html;
    div.id = 'settingsOverlay';
    document.body.appendChild(div);
    
    // Р”РѕР±Р°РІР»СЏРµРј РѕР±СЂР°Р±РѕС‚С‡РёРєРё
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
        
        showNotification('Р—РІСѓРєРё', newValue === 'true' ? 'Р—РІСѓРєРё РІРєР»СЋС‡РµРЅС‹ рџ”Љ' : 'Р—РІСѓРєРё РІС‹РєР»СЋС‡РµРЅС‹ рџ”‡', 'info');
        closeSettings();
    };
\n    window.toggleThemeFromSettings = function() {
        if (typeof toggleTheme === "function") {
            toggleTheme();
        }
        closeSettings();
    };
    
    window.logoutFromSettings = function() {
        if (confirm('Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ РІС‹Р№С‚Рё РёР· Р°РєРєР°СѓРЅС‚Р°?')) {
            if (typeof logout === 'function') {
                logout();
            }
            closeSettings();
        }
    };
    
    // Р—Р°РєСЂС‹С‚РёРµ РїРѕ РєР»РёРєСѓ РЅР° РѕРІРµСЂР»РµР№
    div.addEventListener('click', function(e) {
        if (e.target === this) {
            closeSettings();
        }
    });
    
    // Р—Р°РєСЂС‹С‚РёРµ РїРѕ ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeSettings();
        }
    });
}

