/* ==========================================================
   РђРЈР”РРћР—Р’РћРќРљР (РќРћР’РђРЇ Р¤РЈРќРљР¦РРЇ)
   ========================================================== */

// Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ РґР»СЏ Р·РІРѕРЅРєРѕРІ
let peerConnection = null;
let localStream = null;
let callTimer = null;
let callDuration = 0;
let isMuted = false;
let isSpeakerOn = true;
let currentCall = null;

// РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ STUN/TURN СЃРµСЂРІРµСЂРѕРІ
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// РРЅРёС†РёРёСЂРѕРІР°С‚СЊ Р°СѓРґРёРѕР·РІРѕРЅРѕРє
async function startAudioCall() {
    if (isGroupChat) {
        showNotification('РћС€РёР±РєР°', 'Р“СЂСѓРїРїРѕРІС‹Рµ Р·РІРѕРЅРєРё РїРѕРєР° РЅРµ РїРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ', 'warning');
        return;
    }
    if (!currentChatId || !currentChatPartner) {
        showNotification('РћС€РёР±РєР°', 'Р’С‹Р±РµСЂРёС‚Рµ РєРѕРЅС‚Р°РєС‚ РґР»СЏ Р·РІРѕРЅРєР°', 'error');
        return;
    }

    try {
        // РџРѕРєР°Р·С‹РІР°РµРј UI Р·РІРѕРЅРєР°
        showCallUI(currentChatPartner, 'outgoing');
        
        // РџРѕР»СѓС‡Р°РµРј РґРѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });

        // РЎРѕР·РґР°РµРј PeerConnection
        peerConnection = new RTCPeerConnection(rtcConfiguration);

        // Р”РѕР±Р°РІР»СЏРµРј Р»РѕРєР°Р»СЊРЅС‹Р№ РїРѕС‚РѕРє
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // РћР±СЂР°Р±РѕС‚РєР° СѓРґР°Р»РµРЅРЅРѕРіРѕ РїРѕС‚РѕРєР°
        peerConnection.ontrack = (event) => {
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.autoplay = true;
            document.body.appendChild(remoteAudio);
        };

        // РћР±СЂР°Р±РѕС‚РєР° ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // РћС‚РїСЂР°РІР»СЏРµРј candidate СЃРѕР±РµСЃРµРґРЅРёРєСѓ С‡РµСЂРµР· Firebase
                db.ref(`calls/${currentChatId}/candidates`).push({
                    candidate: event.candidate,
                    from: username
                });
            }
        };

        // РЎРѕР·РґР°РµРј offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // РЎРѕС…СЂР°РЅСЏРµРј РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ Р·РІРѕРЅРєРµ РІ Firebase
        const callData = {
            from: username,
            to: currentChatPartner,
            offer: {
                type: offer.type,
                sdp: offer.sdp
            },
            status: 'calling',
            timestamp: Date.now()
        };

        await db.ref(`calls/${currentChatId}`).set(callData);
        
        // РЎР»СѓС€Р°РµРј РѕС‚РІРµС‚
        listenForCallAnswer();
        
        // Р’РѕСЃРїСЂРѕРёР·РІРѕРґРёРј Р·РІСѓРє РІС‹Р·РѕРІР°
        playCallSound();
        
    } catch (error) {
        console.error('РћС€РёР±РєР° РїСЂРё РёРЅРёС†РёР°С†РёРё Р·РІРѕРЅРєР°:', error);
        
        if (error.name === 'NotAllowedError') {
            showNotification('РћС€РёР±РєР°', 'Р Р°Р·СЂРµС€РёС‚Рµ РґРѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ', 'error');
        } else {
            showNotification('РћС€РёР±РєР°', 'РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°С‡Р°С‚СЊ Р·РІРѕРЅРѕРє', 'error');
        }
        
        endCall();
    }
}

// РџРѕРєР°Р·Р°С‚СЊ UI Р·РІРѕРЅРєР°
function showCallUI(name, type) {
    const callOverlay = document.getElementById('callOverlay');
    const callAvatar = document.getElementById('callAvatar');
    const callName = document.getElementById('callName');
    const callStatus = document.getElementById('callStatus');
    
    callAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0088cc&color=fff&size=120`;
    callName.textContent = name;
    
    if (type === 'outgoing') {
        callStatus.textContent = 'Р—РІРѕРЅРёРј...';
    } else {
        callStatus.textContent = 'Р’С…РѕРґСЏС‰РёР№ Р·РІРѕРЅРѕРє...';
    }
    
    callOverlay.classList.add('active');
}

// РЎРєСЂС‹С‚СЊ UI Р·РІРѕРЅРєР°
function hideCallUI() {
    const callOverlay = document.getElementById('callOverlay');
    callOverlay.classList.remove('active');
    
    const callTimer = document.getElementById('callTimer');
    callTimer.style.display = 'none';
    callTimer.textContent = '00:00';
}

// РЎР»СѓС€Р°С‚СЊ РѕС‚РІРµС‚ РЅР° Р·РІРѕРЅРѕРє
function listenForCallAnswer() {
    db.ref(`calls/${currentChatId}`).on('value', async (snapshot) => {
        const callData = snapshot.val();
        
        if (!callData) return;
        
        if (callData.answer && callData.status === 'connected') {
            // РЎРѕР±РµСЃРµРґРЅРёРє РѕС‚РІРµС‚РёР»
            const answer = new RTCSessionDescription(callData.answer);
            await peerConnection.setRemoteDescription(answer);
            
            // Р—Р°РїСѓСЃРєР°РµРј С‚Р°Р№РјРµСЂ
            startCallTimer();
            
            document.getElementById('callStatus').textContent = 'РЎРѕРµРґРёРЅРµРЅРѕ';
            
            // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј Р·РІСѓРє РІС‹Р·РѕРІР°
            stopCallSound();
        } else if (callData.status === 'rejected') {
            showNotification('Р—РІРѕРЅРѕРє', 'РЎРѕР±РµСЃРµРґРЅРёРє РѕС‚РєР»РѕРЅРёР» Р·РІРѕРЅРѕРє', 'warning');
            endCall();
        } else if (callData.status === 'ended') {
            endCall();
        }
    });
    
    // РЎР»СѓС€Р°РµРј ICE candidates
    db.ref(`calls/${currentChatId}/candidates`).on('child_added', async (snapshot) => {
        const candidateData = snapshot.val();
        
        if (candidateData.from !== username && peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
            } catch (error) {
                console.error('РћС€РёР±РєР° РґРѕР±Р°РІР»РµРЅРёСЏ ICE candidate:', error);
            }
        }
    });
}

// РџСЂРёРЅСЏС‚СЊ РІС…РѕРґСЏС‰РёР№ Р·РІРѕРЅРѕРє
async function acceptIncomingCall(callData) {
    try {
        showCallUI(callData.from, 'incoming');
        
        // РџРѕР»СѓС‡Р°РµРј РґРѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // РЎРѕР·РґР°РµРј PeerConnection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        peerConnection.ontrack = (event) => {
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.autoplay = true;
            document.body.appendChild(remoteAudio);
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                db.ref(`calls/${currentChatId}/candidates`).push({
                    candidate: event.candidate,
                    from: username
                });
            }
        };
        
        // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј СѓРґР°Р»РµРЅРЅРѕРµ РѕРїРёСЃР°РЅРёРµ РёР· offer
        await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
        
        // РЎРѕР·РґР°РµРј answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // РћС‚РїСЂР°РІР»СЏРµРј answer С‡РµСЂРµР· Firebase
        await db.ref(`calls/${currentChatId}`).update({
            answer: {
                type: answer.type,
                sdp: answer.sdp
            },
            status: 'connected'
        });
        
        startCallTimer();
        document.getElementById('callStatus').textContent = 'РЎРѕРµРґРёРЅРµРЅРѕ';
        
    } catch (error) {
        console.error('РћС€РёР±РєР° РїСЂРё РѕС‚РІРµС‚Рµ РЅР° Р·РІРѕРЅРѕРє:', error);
        showNotification('РћС€РёР±РєР°', 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РІРµС‚РёС‚СЊ РЅР° Р·РІРѕРЅРѕРє', 'error');
        endCall();
    }
}

// Р—Р°РІРµСЂС€РёС‚СЊ Р·РІРѕРЅРѕРє
async function endCall() {
    try {
        // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј С‚Р°Р№РјРµСЂ
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
            callDuration = 0;
        }
        
        // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј Р»РѕРєР°Р»СЊРЅС‹Р№ РїРѕС‚РѕРє
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Р—Р°РєСЂС‹РІР°РµРј peer connection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        // РЈРґР°Р»СЏРµРј РІСЃРµ audio СЌР»РµРјРµРЅС‚С‹
        document.querySelectorAll('audio').forEach(audio => {
            audio.srcObject = null;
            audio.remove();
        });
        
        // РћР±РЅРѕРІР»СЏРµРј СЃС‚Р°С‚СѓСЃ РІ Firebase
        if (currentChatId) {
            await db.ref(`calls/${currentChatId}`).update({
                status: 'ended',
                endTime: Date.now()
            });
            
            // РЈРґР°Р»СЏРµРј СЃР»СѓС€Р°С‚РµР»РµР№
            db.ref(`calls/${currentChatId}`).off();
        }
        
        // РЎРєСЂС‹РІР°РµРј UI
        hideCallUI();
        
        // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј Р·РІСѓРє
        stopCallSound();
        
        // РЎР±СЂР°СЃС‹РІР°РµРј СЃРѕСЃС‚РѕСЏРЅРёРµ
        isMuted = false;
        isSpeakerOn = true;
        
        showNotification('Р—РІРѕРЅРѕРє', 'Р—РІРѕРЅРѕРє Р·Р°РІРµСЂС€РµРЅ', 'info');
        
    } catch (error) {
        console.error('РћС€РёР±РєР° РїСЂРё Р·Р°РІРµСЂС€РµРЅРёРё Р·РІРѕРЅРєР°:', error);
        hideCallUI();
    }
}

// Р—Р°РїСѓСЃС‚РёС‚СЊ С‚Р°Р№РјРµСЂ Р·РІРѕРЅРєР°
function startCallTimer() {
    const timerElement = document.getElementById('callTimer');
    timerElement.style.display = 'block';
    
    callDuration = 0;
    callTimer = setInterval(() => {
        callDuration++;
        const minutes = Math.floor(callDuration / 60).toString().padStart(2, '0');
        const seconds = (callDuration % 60).toString().padStart(2, '0');
        timerElement.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

// РџРµСЂРµРєР»СЋС‡РёС‚СЊ РјРёРєСЂРѕС„РѕРЅ
function toggleMute() {
    if (!localStream) return;
    
    isMuted = !isMuted;
    const audioTrack = localStream.getAudioTracks()[0];
    
    if (audioTrack) {
        audioTrack.enabled = !isMuted;
    }
    
    const muteBtn = document.getElementById('muteBtn');
    
    if (isMuted) {
        muteBtn.classList.add('active');
        muteBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
        `;
        showNotification('РњРёРєСЂРѕС„РѕРЅ', 'РњРёРєСЂРѕС„РѕРЅ РІС‹РєР»СЋС‡РµРЅ', 'info');
    } else {
        muteBtn.classList.remove('active');
        muteBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
        `;
        showNotification('РњРёРєСЂРѕС„РѕРЅ', 'РњРёРєСЂРѕС„РѕРЅ РІРєР»СЋС‡РµРЅ', 'info');
    }
}

// РџРµСЂРµРєР»СЋС‡РёС‚СЊ РґРёРЅР°РјРёРє
function toggleSpeaker() {
    isSpeakerOn = !isSpeakerOn;
    
    const speakerBtn = document.getElementById('speakerBtn');
    
    if (isSpeakerOn) {
        speakerBtn.classList.remove('active');
        showNotification('Р”РёРЅР°РјРёРє', 'Р”РёРЅР°РјРёРє РІРєР»СЋС‡РµРЅ', 'info');
    } else {
        speakerBtn.classList.add('active');
        showNotification('Р”РёРЅР°РјРёРє', 'Р”РёРЅР°РјРёРє РІС‹РєР»СЋС‡РµРЅ', 'info');
    }
    
    // РР·РјРµРЅСЏРµРј РіСЂРѕРјРєРѕСЃС‚СЊ СѓРґР°Р»РµРЅРЅРѕРіРѕ Р°СѓРґРёРѕ
    document.querySelectorAll('audio').forEach(audio => {
        audio.volume = isSpeakerOn ? 1.0 : 0.3;
    });
}

// Р—РІСѓРє РІС‹Р·РѕРІР°
let callSoundInterval = null;

function playCallSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    callSoundInterval = setInterval(() => {
        // РЎРѕР·РґР°РµРј РґРІР° С‚РѕРЅР° РґР»СЏ РјРµР»РѕРґРёРё Р·РІРѕРЅРєР°
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator1.frequency.value = 800;
        oscillator2.frequency.value = 1000;
        oscillator1.type = 'sine';
        oscillator2.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.5);
        oscillator2.stop(audioContext.currentTime + 0.5);
    }, 2000);
}

function stopCallSound() {
    if (callSoundInterval) {
        clearInterval(callSoundInterval);
        callSoundInterval = null;
    }
}

// РЎР»СѓС€Р°С‚РµР»СЊ РІС…РѕРґСЏС‰РёС… Р·РІРѕРЅРєРѕРІ
function listenForIncomingCalls() {
    if (!username) return;
    
    db.ref('calls').on('child_added', (snapshot) => {
        const callData = snapshot.val();
        const callId = snapshot.key;
        
        // РџСЂРѕРІРµСЂСЏРµРј, РµСЃР»Рё Р·РІРѕРЅРѕРє РЅР°Рј
        if (callData && callData.to === username && callData.status === 'calling') {
            // РџРѕРєР°Р·С‹РІР°РµРј СѓРІРµРґРѕРјР»РµРЅРёРµ Рѕ РІС…РѕРґСЏС‰РµРј Р·РІРѕРЅРєРµ
            const accept = confirm(`Р’С…РѕРґСЏС‰РёР№ Р·РІРѕРЅРѕРє РѕС‚ ${callData.from}. РџСЂРёРЅСЏС‚СЊ?`);
            
            if (accept) {
                currentChatId = callId;
                currentChatPartner = callData.from;
                acceptIncomingCall(callData);
            } else {
                // РћС‚РєР»РѕРЅСЏРµРј Р·РІРѕРЅРѕРє
                db.ref(`calls/${callId}`).update({
                    status: 'rejected'
                });
            }
        }
    });
}

// РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РїСЂРё Р·Р°РіСЂСѓР·РєРµ
if (typeof window !== 'undefined') {
    window.startAudioCall = startAudioCall;
    window.endCall = endCall;
    window.toggleMute = toggleMute;
    window.toggleSpeaker = toggleSpeaker;
}

console.log('вњ… РњРѕРґСѓР»СЊ Р°СѓРґРёРѕР·РІРѕРЅРєРѕРІ Р·Р°РіСЂСѓР¶РµРЅ');

