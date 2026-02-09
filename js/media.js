/* ==========================================================
   8. РњР•Р”РРђР¤РђР™Р›Р« Р Р“РћР›РћРЎРћР’Р«Р• РЎРћРћР‘Р©Р•РќРРЇ (РРЎРџР РђР’Р›Р•РќРќРђРЇ Р’Р•Р РЎРРЇ)
   ========================================================== */

// Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ РґР»СЏ Р·Р°РїРёСЃРё РіРѕР»РѕСЃРѕРІС‹С… СЃРѕРѕР±С‰РµРЅРёР№
let voiceRecorder = null;
let voiceChunks = [];
let voiceStream = null;
let voiceRecordingTimer = null;
let voiceRecordingTime = 0;

// Р¤СѓРЅРєС†РёСЏ Р·Р°РїСѓСЃРєР° Р·Р°РїРёСЃРё РіРѕР»РѕСЃРѕРІРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ
async function startVoiceRecord() {
    // РџСЂРѕРІРµСЂРєР° РїРѕРґРґРµСЂР¶РєРё Р±СЂР°СѓР·РµСЂРѕРј
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('Р’Р°С€ Р±СЂР°СѓР·РµСЂ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ Р·Р°РїРёСЃСЊ СЃ РјРёРєСЂРѕС„РѕРЅР°. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РёСЃРїРѕР»СЊР·СѓР№С‚Рµ СЃРѕРІСЂРµРјРµРЅРЅС‹Р№ Р±СЂР°СѓР·РµСЂ (Chrome, Firefox, Edge).');
        return;
    }
    
    try {
        // Р—Р°РєСЂС‹РІР°РµРј РјРµРЅСЋ РІС‹Р±РѕСЂР° С‚РёРїР° Р·Р°РїРёСЃРё
        if (document.getElementById('recordTypeMenu').classList.contains('active')) {
            document.getElementById('recordTypeMenu').classList.remove('active');
        }
        
        // РџСЂРѕРІРµСЂСЏРµРј, РЅР°С…РѕРґРёРјСЃСЏ Р»Рё РјС‹ РІ СЂРµР¶РёРјРµ СЂР°Р·СЂР°Р±РѕС‚РєРё
        const isDevMode = window.isLocalFile && window.isLocalFile();
        
        if (isDevMode) {
            // Р’ СЂРµР¶РёРјРµ СЂР°Р·СЂР°Р±РѕС‚РєРё РїСЂРµРґР»Р°РіР°РµРј РІС‹Р±РѕСЂ
            const useTest = confirm('Р РµР¶РёРј СЂР°Р·СЂР°Р±РѕС‚РєРё:\n\n1. РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ СЂРµР°Р»СЊРЅС‹Р№ РјРёРєСЂРѕС„РѕРЅ\n2. Р—Р°РїСѓСЃС‚РёС‚СЊ С‚РµСЃС‚РѕРІСѓСЋ Р·Р°РїРёСЃСЊ\n\nР’С‹Р±РµСЂРёС‚Рµ "РћРљ" РґР»СЏ СЂРµР°Р»СЊРЅРѕР№ Р·Р°РїРёСЃРё РёР»Рё "РћС‚РјРµРЅР°" РґР»СЏ С‚РµСЃС‚РѕРІРѕР№ Р·Р°РїРёСЃРё.');
            
            if (!useTest) {
                testVoiceRecording();
                return;
            }
        }
        
        // РџРѕРєР°Р·С‹РІР°РµРј РѕРІРµСЂР»РµР№ Р·Р°РїРёСЃРё
        document.getElementById('voiceRecordOverlay').style.display = 'flex';
        
        // РџРѕР»СѓС‡Р°РµРј РґРѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ
        voiceStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        // РќР°СЃС‚СЂР°РёРІР°РµРј MediaRecorder
        const options = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
        };
        
        try {
            voiceRecorder = new MediaRecorder(voiceStream, options);
        } catch (e) {
            console.warn('РќРµ СѓРґР°Р»РѕСЃСЊ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РєРѕРґРµРє opus, РёСЃРїРѕР»СЊР·СѓРµРј СЃС‚Р°РЅРґР°СЂС‚РЅС‹Р№:', e);
            voiceRecorder = new MediaRecorder(voiceStream);
        }
        
        voiceChunks = [];
        
        voiceRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                voiceChunks.push(event.data);
            }
        };
        
        voiceRecorder.onstop = async () => {
            if (voiceChunks.length === 0) {
                showError('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїРёСЃР°С‚СЊ Р°СѓРґРёРѕ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РїРѕРїСЂРѕР±СѓР№С‚Рµ СЃРЅРѕРІР°.');
                return;
            }
            
            const blob = new Blob(voiceChunks, { type: 'audio/webm' });
            
            // РџСЂРѕРІРµСЂСЏРµРј СЂР°Р·РјРµСЂ С„Р°Р№Р»Р° (РјР°РєСЃРёРјСѓРј 10MB)
            if (blob.size > 10 * 1024 * 1024) {
                showError('РђСѓРґРёРѕСЃРѕРѕР±С‰РµРЅРёРµ СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕРµ. РњР°РєСЃРёРјСѓРј 10РњР‘');
                return;
            }
            
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Audio = reader.result;
                await sendVoiceMessage(base64Audio);
                cleanupVoiceRecording();
            };
            reader.readAsDataURL(blob);
        };
        
        // Р—Р°РїСѓСЃРєР°РµРј Р·Р°РїРёСЃСЊ
        voiceRecorder.start(1000); // РЎРѕР±РёСЂР°РµРј РґР°РЅРЅС‹Рµ РєР°Р¶РґСѓСЋ СЃРµРєСѓРЅРґСѓ
        voiceRecordingTime = 0;
        
        // РћР±РЅРѕРІР»СЏРµРј UI
        document.getElementById("voiceStartBtn").style.display = "none";
        document.getElementById("voiceStopBtn").style.display = "flex";
        
        // Р—Р°РїСѓСЃРєР°РµРј С‚Р°Р№РјРµСЂ
        voiceRecordingTimer = setInterval(() => {
            voiceRecordingTime++;
            const minutes = Math.floor(voiceRecordingTime / 60).toString().padStart(2, '0');
            const seconds = (voiceRecordingTime % 60).toString().padStart(2, '0');
            document.getElementById("voiceTimer").textContent = `${minutes}:${seconds}`;
            
            // РђРЅРёРјР°С†РёСЏ РІРѕР»РЅС‹
            animateVoiceWaveform();
        }, 1000);
        
        showNotification("Р—Р°РїРёСЃСЊ", "РРґС‘С‚ Р·Р°РїРёСЃСЊ РіРѕР»РѕСЃРѕРІРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ...");
        
    } catch (error) {
        console.error('РћС€РёР±РєР° РїСЂРё Р·Р°РїСѓСЃРєРµ Р·Р°РїРёСЃРё:', error);
        
        // РЎРєСЂС‹РІР°РµРј РѕРІРµСЂР»РµР№
        document.getElementById("voiceRecordOverlay").style.display = "none";
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            const useTest = confirm('Р”РѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ Р·Р°РїСЂРµС‰РµРЅ.\n\nР Р°Р·СЂРµС€РёС‚Рµ РґРѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ РІ РЅР°СЃС‚СЂРѕР№РєР°С… Р±СЂР°СѓР·РµСЂР° РёР»Рё Р·Р°РїСѓСЃС‚РёС‚Рµ С‚РµСЃС‚РѕРІСѓСЋ Р·Р°РїРёСЃСЊ РґР»СЏ РґРµРјРѕРЅСЃС‚СЂР°С†РёРё.\n\nР—Р°РїСѓСЃС‚РёС‚СЊ С‚РµСЃС‚РѕРІСѓСЋ Р·Р°РїРёСЃСЊ?');
            
            if (useTest) {
                testVoiceRecording();
            } else {
                showError('Р”Р»СЏ Р·Р°РїРёСЃРё РіРѕР»РѕСЃРѕРІС‹С… СЃРѕРѕР±С‰РµРЅРёР№ РЅРµРѕР±С…РѕРґРёРјРѕ СЂР°Р·СЂРµС€РёС‚СЊ РґРѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ.');
            }
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            const useTest = confirm('РњРёРєСЂРѕС„РѕРЅ РЅРµ РЅР°Р№РґРµРЅ.\n\nРџРѕРґРєР»СЋС‡РёС‚Рµ РјРёРєСЂРѕС„РѕРЅ РёР»Рё Р·Р°РїСѓСЃС‚РёС‚Рµ С‚РµСЃС‚РѕРІСѓСЋ Р·Р°РїРёСЃСЊ РґР»СЏ РґРµРјРѕРЅСЃС‚СЂР°С†РёРё.\n\nР—Р°РїСѓСЃС‚РёС‚СЊ С‚РµСЃС‚РѕРІСѓСЋ Р·Р°РїРёСЃСЊ?');
            
            if (useTest) {
                testVoiceRecording();
            } else {
                showError('РњРёРєСЂРѕС„РѕРЅ РЅРµ РЅР°Р№РґРµРЅ. РџРѕРґРєР»СЋС‡РёС‚Рµ РјРёРєСЂРѕС„РѕРЅ Рё РїРѕРїСЂРѕР±СѓР№С‚Рµ СЃРЅРѕРІР°.');
            }
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            const useTest = confirm('РњРёРєСЂРѕС„РѕРЅ СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґСЂСѓРіРёРј РїСЂРёР»РѕР¶РµРЅРёРµРј.\n\nР—Р°РєСЂРѕР№С‚Рµ РґСЂСѓРіРёРµ РїСЂРёР»РѕР¶РµРЅРёСЏ, РёСЃРїРѕР»СЊР·СѓСЋС‰РёРµ РјРёРєСЂРѕС„РѕРЅ, РёР»Рё Р·Р°РїСѓСЃС‚РёС‚Рµ С‚РµСЃС‚РѕРІСѓСЋ Р·Р°РїРёСЃСЊ.\n\nР—Р°РїСѓСЃС‚РёС‚СЊ С‚РµСЃС‚РѕРІСѓСЋ Р·Р°РїРёСЃСЊ?');
            
            if (useTest) {
                testVoiceRecording();
            } else {
                showError('РњРёРєСЂРѕС„РѕРЅ СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґСЂСѓРіРёРј РїСЂРёР»РѕР¶РµРЅРёРµРј.');
            }
        } else {
            // Р”Р»СЏ РґСЂСѓРіРёС… РѕС€РёР±РѕРє РїСЂРµРґР»Р°РіР°РµРј С‚РµСЃС‚РѕРІСѓСЋ Р·Р°РїРёСЃСЊ
            const useTest = confirm('РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РґРѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ. Р—Р°РїСѓСЃС‚РёС‚СЊ С‚РµСЃС‚РѕРІСѓСЋ Р·Р°РїРёСЃСЊ РґР»СЏ РґРµРјРѕРЅСЃС‚СЂР°С†РёРё?');
            
            if (useTest) {
                testVoiceRecording();
            } else {
                showError('РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РґРѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ. РџСЂРѕРІРµСЂСЊС‚Рµ СЂР°Р·СЂРµС€РµРЅРёСЏ Р±СЂР°СѓР·РµСЂР°.');
            }
        }
    }
}

// Р”Р»СЏ С‚РµСЃС‚РёСЂРѕРІР°РЅРёСЏ Р±РµР· РјРёРєСЂРѕС„РѕРЅР°
function testVoiceRecording() {
    if (confirm('Р—Р°РїСѓСЃС‚РёС‚СЊ С‚РµСЃС‚ Р·Р°РїРёСЃРё Р±РµР· РјРёРєСЂРѕС„РѕРЅР°? (5 СЃРµРєСѓРЅРґ)\n\nР­С‚Рѕ РґРµРјРѕРЅСЃС‚СЂР°С†РёСЏ С„СѓРЅРєС†РёРѕРЅР°Р»Р° РІ СЂРµР¶РёРјРµ СЂР°Р·СЂР°Р±РѕС‚РєРё.')) {
        showNotification('РўРµСЃС‚', 'РўРµСЃС‚РѕРІР°СЏ Р·Р°РїРёСЃСЊ Р·Р°РїСѓС‰РµРЅР°');
        
        // РЎРєСЂС‹РІР°РµРј РґСЂСѓРіРёРµ РјРµРЅСЋ
        document.getElementById('recordTypeMenu').classList.remove('active');
        
        // РџРѕРєР°Р·С‹РІР°РµРј РѕРІРµСЂР»РµР№
        document.getElementById("voiceRecordOverlay").style.display = "flex";
        
        // РћР±РЅРѕРІР»СЏРµРј UI
        document.getElementById("voiceStartBtn").style.display = "none";
        document.getElementById("voiceStopBtn").style.display = "flex";
        
        // РРјРёС‚Р°С†РёСЏ Р·Р°РїРёСЃРё
        let testTime = 0;
        const testInterval = setInterval(() => {
            testTime++;
            const minutes = Math.floor(testTime / 60).toString().padStart(2, '0');
            const seconds = (testTime % 60).toString().padStart(2, '0');
            document.getElementById("voiceTimer").textContent = `${minutes}:${seconds}`;
            
            // РђРЅРёРјР°С†РёСЏ РІРѕР»РЅС‹
            animateVoiceWaveform();
            
            if (testTime >= 5) {
                clearInterval(testInterval);
                
                // РЎРєСЂС‹РІР°РµРј РєРЅРѕРїРєРё
                document.getElementById("voiceStartBtn").style.display = "flex";
                document.getElementById("voiceStopBtn").style.display = "none";
                document.getElementById("voiceTimer").textContent = "00:00";
                
                // РЎРєСЂС‹РІР°РµРј РѕРІРµСЂР»РµР№ С‡РµСЂРµР· РЅРµР±РѕР»СЊС€СѓСЋ Р·Р°РґРµСЂР¶РєСѓ
                setTimeout(() => {
                    document.getElementById("voiceRecordOverlay").style.display = "none";
                    
                    // РЎРѕР·РґР°РµРј С‚РµСЃС‚РѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ
                    showNotification('РўРµСЃС‚', 'РўРµСЃС‚РѕРІР°СЏ Р·Р°РїРёСЃСЊ Р·Р°РІРµСЂС€РµРЅР°. РћС‚РїСЂР°РІР»СЏРµРј РґРµРјРѕ-СЃРѕРѕР±С‰РµРЅРёРµ...');
                    
                    // Р‘Р°Р·РѕРІР°СЏ РґРµРјРѕ-Р°СѓРґРёРѕ (РїСѓСЃС‚Р°СЏ Р°СѓРґРёРѕ РІ С„РѕСЂРјР°С‚Рµ WAV)
                    const demoAudio = 'data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAAB=';
                    
                    // РћС‚РїСЂР°РІР»СЏРµРј РґРµРјРѕ-СЃРѕРѕР±С‰РµРЅРёРµ
                    setTimeout(() => {
                        sendVoiceMessage(demoAudio, true);
                    }, 1000);
                }, 100);
            }
        }, 1000);
        
        // РћР±СЂР°Р±РѕС‚С‡РёРє РєРЅРѕРїРєРё РѕСЃС‚Р°РЅРѕРІРєРё
        const originalStop = window.stopVoiceRecord;
        window.stopVoiceRecord = function() {
            clearInterval(testInterval);
            window.stopVoiceRecord = originalStop;
            
            document.getElementById("voiceStartBtn").style.display = "flex";
            document.getElementById("voiceStopBtn").style.display = "none";
            document.getElementById("voiceTimer").textContent = "00:00";
            document.getElementById("voiceRecordOverlay").style.display = "none";
            
            if (testTime > 0) {
                const demoAudio = 'data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAAB=';
                sendVoiceMessage(demoAudio, true);
            }
        };
    }
}

// РђРЅРёРјР°С†РёСЏ РІРѕР»РЅС‹ РїСЂРё Р·Р°РїРёСЃРё
function animateVoiceWaveform() {
    const waveform = document.getElementById('voiceWaveform');
    if (!waveform) return;
    
    const lines = waveform.querySelectorAll('.waveform-line');
    lines.forEach(line => {
        // Р“РµРЅРµСЂРёСЂСѓРµРј СЃР»СѓС‡Р°Р№РЅСѓСЋ РІС‹СЃРѕС‚Сѓ РґР»СЏ РІРѕР»РЅС‹
        const randomHeight = 20 + Math.random() * 60;
        line.style.height = `${randomHeight}px`;
        line.style.transition = 'height 0.1s ease';
    });
}

// РћСЃС‚Р°РЅРѕРІРєР° Р·Р°РїРёСЃРё РіРѕР»РѕСЃРѕРІРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ
function stopVoiceRecord() {
    if (!voiceRecorder || voiceRecorder.state === 'inactive') {
        // Р•СЃР»Рё РЅРµС‚ Р°РєС‚РёРІРЅРѕРіРѕ СЂРµРєРѕСЂРґРµСЂР°, РїСЂРѕСЃС‚Рѕ СЃРєСЂС‹РІР°РµРј РѕРІРµСЂР»РµР№
        document.getElementById("voiceStartBtn").style.display = "flex";
        document.getElementById("voiceStopBtn").style.display = "none";
        document.getElementById("voiceTimer").textContent = "00:00";
        document.getElementById("voiceRecordOverlay").style.display = "none";
        return;
    }
    
    // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј Р·Р°РїРёСЃСЊ
    voiceRecorder.stop();
    
    // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј С‚Р°Р№РјРµСЂ
    if (voiceRecordingTimer) {
        clearInterval(voiceRecordingTimer);
        voiceRecordingTimer = null;
    }
    
    // РћР±РЅРѕРІР»СЏРµРј UI
    document.getElementById("voiceStartBtn").style.display = "flex";
    document.getElementById("voiceStopBtn").style.display = "none";
    document.getElementById("voiceTimer").textContent = "00:00";
    
    // РЎРєСЂС‹РІР°РµРј РѕРІРµСЂР»РµР№ С‡РµСЂРµР· РЅРµР±РѕР»СЊС€СѓСЋ Р·Р°РґРµСЂР¶РєСѓ, С‡С‚РѕР±С‹ СѓСЃРїРµР» РѕР±СЂР°Р±РѕС‚Р°С‚СЊСЃСЏ onstop
    setTimeout(() => {
        document.getElementById("voiceRecordOverlay").style.display = "none";
    }, 100);
    
    if (voiceRecordingTime > 0) {
        showNotification("РЈСЃРїРµС€РЅРѕ", "Р“РѕР»РѕСЃРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ РѕС‚РїСЂР°РІР»СЏРµС‚СЃСЏ...");
    }
}

// РћС‚РјРµРЅР° Р·Р°РїРёСЃРё РіРѕР»РѕСЃРѕРІРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ
function cancelVoiceRecord() {
    // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј Р·Р°РїРёСЃСЊ РµСЃР»Рё РѕРЅР° РёРґРµС‚
    if (voiceRecorder && voiceRecorder.state !== 'inactive') {
        voiceRecorder.stop();
    }
    
    // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј РїРѕС‚РѕРє
    if (voiceStream) {
        voiceStream.getTracks().forEach(track => track.stop());
        voiceStream = null;
    }
    
    // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј С‚Р°Р№РјРµСЂ
    if (voiceRecordingTimer) {
        clearInterval(voiceRecordingTimer);
        voiceRecordingTimer = null;
    }
    
    // РЎР±СЂР°СЃС‹РІР°РµРј UI
    document.getElementById("voiceStartBtn").style.display = "flex";
    document.getElementById("voiceStopBtn").style.display = "none";
    document.getElementById("voiceTimer").textContent = "00:00";
    document.getElementById("voiceRecordOverlay").style.display = "none";
}

// РћС‡РёСЃС‚РєР° СЂРµСЃСѓСЂСЃРѕРІ РїРѕСЃР»Рµ Р·Р°РїРёСЃРё
function cleanupVoiceRecording() {
    if (voiceStream) {
        voiceStream.getTracks().forEach(track => track.stop());
        voiceStream = null;
    }
    
    voiceRecorder = null;
    voiceChunks = [];
    voiceRecordingTime = 0;
}

// РћС‚РїСЂР°РІРєР° РіРѕР»РѕСЃРѕРІРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ
async function sendVoiceMessage(audioData, isTest = false) {
    if (!checkConnection() || !currentChatId || !chatRef || !username) {
        showError('РќРµРІРѕР·РјРѕР¶РЅРѕ РѕС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ');
        return;
    }
    
    if (!isTest) {
        showLoading();
    }
    
    try {
        const messageText = isTest ? 'рџЋ¤ РўРµСЃС‚РѕРІРѕРµ РіРѕР»РѕСЃРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ (РґРµРјРѕ)' : 'рџЋ¤ Р“РѕР»РѕСЃРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ';
        
        const message = {
            from: username,
            text: messageText,
            audio: audioData,
            time: Date.now(),
            sent: true,
            delivered: true,
            read: false,
            status: 'sent',
            type: 'voice_message',
            duration: voiceRecordingTime || 5,
            isTest: isTest || false
        };
        
        await chatRef.push(message);
        
        if (isTest) {
            showNotification('Р”РµРјРѕ', 'РўРµСЃС‚РѕРІРѕРµ РіРѕР»РѕСЃРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ РѕС‚РїСЂР°РІР»РµРЅРѕ!');
        } else {
            showNotification('РЈСЃРїРµС€РЅРѕ', 'Р“РѕР»РѕСЃРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ РѕС‚РїСЂР°РІР»РµРЅРѕ!');
        }
        
        // Р’РѕСЃРїСЂРѕРёР·РІРѕРґРёРј Р·РІСѓРє РѕС‚РїСЂР°РІРєРё
        if (typeof playSendSound === 'function') {
            playSendSound();
        }
        
    } catch (error) {
        console.error('РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё РіРѕР»РѕСЃРѕРІРѕРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ:', error);
        
        if (error.message && error.message.includes('greater than 10485760')) {
            showError('РђСѓРґРёРѕСЃРѕРѕР±С‰РµРЅРёРµ СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕРµ. РњР°РєСЃРёРјСѓРј 10РњР‘');
        } else {
            showError('РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РіРѕР»РѕСЃРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ', () => sendVoiceMessage(audioData, isTest));
        }
    } finally {
        if (!isTest) {
            hideLoading();
        }
    }
}

// Р¤СѓРЅРєС†РёСЏ Р·Р°РїСѓСЃРєР° Р°СѓРґРёРѕР·Р°РїРёСЃРё РёР· РјРµРЅСЋ РІС‹Р±РѕСЂР° С‚РёРїР°
function startAudioRecording() {
    document.getElementById('recordTypeMenu').classList.remove('active');
    // Р”Р°РµРј РЅРµР±РѕР»СЊС€СѓСЋ Р·Р°РґРµСЂР¶РєСѓ РґР»СЏ Р°РЅРёРјР°С†РёРё
    setTimeout(() => {
        document.getElementById("voiceRecordOverlay").style.display = "flex";
    }, 100);
}

// Р”РµР»Р°РµРј С„СѓРЅРєС†РёСЋ РґРѕСЃС‚СѓРїРЅРѕР№ РіР»РѕР±Р°Р»СЊРЅРѕ РґР»СЏ РІС‹Р·РѕРІР° РёР· РєРѕРЅСЃРѕР»Рё
window.testVoiceRecording = testVoiceRecording;

/* ==========================================================
   9. РџР РРљР Р•РџР›Р•РќРР• Р¤РђР™Р›РћР’ (Р‘Р•Р— РР—РњР•РќР•РќРР™)
   ========================================================== */
function attachPhoto() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = async e => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        showLoading();
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = async ev => await sendMediaMessage('photo', ev.target.result, file.name);
            reader.readAsDataURL(file);
        }
        hideLoading();
        document.getElementById("attachmentMenu").classList.remove("active");
    };
    inp.click();
}

function attachVideo() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'video/*';
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        showLoading();
        const reader = new FileReader();
        reader.onload = async ev => await sendMediaMessage('video', ev.target.result, file.name);
        reader.readAsDataURL(file);
        hideLoading();
        document.getElementById("attachmentMenu").classList.remove("active");
    };
    inp.click();
}

function attachDocument() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.zip,.rar';
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        showLoading();
        const reader = new FileReader();
        reader.onload = async ev => await sendMediaMessage('document', ev.target.result, file.name, file.size);
        reader.readAsDataURL(file);
        hideLoading();
        document.getElementById("attachmentMenu").classList.remove("active");
    };
    inp.click();
}

function attachAudio() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'audio/*';
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        showLoading();
        const reader = new FileReader();
        reader.onload = async ev => await sendMediaMessage('audio', ev.target.result, file.name);
        reader.readAsDataURL(file);
        hideLoading();
        document.getElementById("attachmentMenu").classList.remove("active");
    };
    inp.click();
}

async function sendMediaMessage(type, data, filename, filesize) {
    if (!checkConnection()) return;
    if (!currentChatId || !chatRef || !username) { 
        showError("Р’С‹Р±РµСЂРёС‚Рµ С‡Р°С‚ РґР»СЏ РѕС‚РїСЂР°РІРєРё!"); 
        return; 
    }
    
    // РџСЂРѕРІРµСЂРєР° СЂР°Р·РјРµСЂР° РґР°РЅРЅС‹С… РґР»СЏ Firebase (РјР°РєСЃРёРјСѓРј 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    const dataSize = new Blob([data]).size;
    
    if (dataSize > MAX_SIZE) {
        showError(`Р¤Р°Р№Р» СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕР№ (${Math.round(dataSize/1024/1024)}MB). РњР°РєСЃРёРјСѓРј 10MB.`);
        return;
    }
    
    try {
        const msg = { 
            from: username, 
            time: Date.now(), 
            sent: true, 
            delivered: true, 
            read: false, 
            status: 'sent' 
        };
        
        switch (type) {
            case 'photo': 
                if (dataSize > 5 * 1024 * 1024) {
                    showError("Р¤РѕС‚Рѕ СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕРµ. РњР°РєСЃРёРјСѓРј 5MB.");
                    return;
                }
                msg.photo = data; 
                msg.text = 'рџ“· Р¤РѕС‚Рѕ'; 
                break;
            case 'video': 
                if (dataSize > 10 * 1024 * 1024) {
                    showError("Р’РёРґРµРѕ СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕРµ. РњР°РєСЃРёРјСѓРј 10MB.");
                    return;
                }
                msg.video = data; 
                msg.text = 'рџЋҐ Р’РёРґРµРѕ'; 
                break;
            case 'audio': 
                if (dataSize > 5 * 1024 * 1024) {
                    showError("РђСѓРґРёРѕ СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕРµ. РњР°РєСЃРёРјСѓРј 5MB.");
                    return;
                }
                msg.audio = data; 
                msg.text = 'рџЋµ РђСѓРґРёРѕ'; 
                break;
            case 'document': 
                msg.document = data; 
                msg.filename = filename; 
                msg.filesize = filesize; 
                msg.text = 'рџ“„ Р”РѕРєСѓРјРµРЅС‚'; 
                break;
        }
        
        await chatRef.push(msg);
        showNotification("РЈСЃРїРµС€РЅРѕ", "Р¤Р°Р№Р» РѕС‚РїСЂР°РІР»РµРЅ!");
        
    } catch (e) {
        console.error(e);
        if (e.message && e.message.includes('greater than 10485760')) {
            showError("Р¤Р°Р№Р» СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕР№ РґР»СЏ РѕС‚РїСЂР°РІРєРё. РњР°РєСЃРёРјСѓРј 10MB.");
        } else {
            showError("РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ С„Р°Р№Р»", () => sendMediaMessage(type, data, filename, filesize));
        }
    }
}

function openMedia(url) { window.open(url, '_blank'); }
