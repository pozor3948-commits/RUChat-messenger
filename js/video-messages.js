/* ==========================================================
   Р’РР”Р•РћРЎРћРћР‘Р©Р•РќРРЇ
   ========================================================== */

let videoRecorder = null;
let videoChunks = [];
let videoStream = null;
let recordingTimer = null;
let recordingStartTime = 0;
let isRecordingVideo = false;
let currentCamera = 'user';

const videoConfig = {
    maxDuration: 60000,
    format: 'webm',
    maxSize: 50 * 1024 * 1024,
    quality: { 
        width: 480, 
        height: 480, 
        frameRate: 30 
    }
};

function initVideoMessages() {
    if (!window.MediaRecorder) {
        console.warn('MediaRecorder РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚СЃСЏ РІ СЌС‚РѕРј Р±СЂР°СѓР·РµСЂРµ');
        return false;
    }
    
    checkCameraPermissions();
    
    return true;
}


async function checkCameraPermissions() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' },
            audio: true 
        });
        
        stream.getTracks().forEach(track => track.stop());
        
        return true;
    } catch (error) {
        console.warn('РќРµС‚ РґРѕСЃС‚СѓРїР° Рє РєР°РјРµСЂРµ:', error);
        return false;
    }
}

async function startVideoRecording() {
    try {
        document.getElementById('recordTypeMenu').classList.remove('active');
        
        const constraints = {
            video: { 
                facingMode: currentCamera,
                width: { ideal: videoConfig.quality.width },
                height: { ideal: videoConfig.quality.height },
                frameRate: { ideal: videoConfig.quality.frameRate }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        };
        
        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const videoPreview = document.getElementById('videoPreview');
        videoPreview.srcObject = videoStream;
        videoPreview.play();
        
        document.getElementById('videoRecordOverlay').style.display = 'flex';
        
        const options = {
            mimeType: 'video/webm;codecs=vp9,opus',
            audioBitsPerSecond: 128000,
            videoBitsPerSecond: 2500000
        };
        
        try {
            videoRecorder = new MediaRecorder(videoStream, options);
        } catch (e) {
            videoRecorder = new MediaRecorder(videoStream);
        }
        
        videoChunks = [];
        
        videoRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                videoChunks.push(event.data);
            }
        };
        
        videoRecorder.onstop = async () => {
            const blob = new Blob(videoChunks, { type: 'video/webm' });
            
            if (blob.size > videoConfig.maxSize) {
                showError('Р’РёРґРµРѕСЃРѕРѕР±С‰РµРЅРёРµ СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕРµ. РњР°РєСЃРёРјСѓРј 50РњР‘');
                return;
            }
            
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Video = reader.result;
                await sendVideoMessage(base64Video);
                cleanupVideoRecording();
            };
            reader.readAsDataURL(blob);
        };
        
    } catch (error) {
        console.error('РћС€РёР±РєР° РїСЂРё Р·Р°РїСѓСЃРєРµ РєР°РјРµСЂС‹:', error);
        showError('РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РґРѕСЃС‚СѓРї Рє РєР°РјРµСЂРµ. РџСЂРѕРІРµСЂСЊС‚Рµ СЂР°Р·СЂРµС€РµРЅРёСЏ.');
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            const useAudioOnly = confirm('РќРµС‚ РґРѕСЃС‚СѓРїР° Рє РєР°РјРµСЂРµ. Р—Р°РїРёСЃР°С‚СЊ С‚РѕР»СЊРєРѕ Р°СѓРґРёРѕСЃРѕРѕР±С‰РµРЅРёРµ?');
            if (useAudioOnly) {
                startAudioRecording();
            }
        }
    }
}

function startVideoRecordingAction() {
    if (!videoRecorder || isRecordingVideo) return;
    
    videoRecorder.start(1000);
    isRecordingVideo = true;
    recordingStartTime = Date.now();
    
    document.getElementById('recordingIndicator').style.display = 'flex';
    document.getElementById('videoRecordBtn').classList.add('recording');
    
    recordingTimer = setInterval(updateRecordingTimer, 1000);
    
    document.addEventListener('mouseup', stopVideoRecordingAction);
    document.addEventListener('touchend', stopVideoRecordingAction);
    
    setTimeout(() => {
        if (isRecordingVideo) {
            stopVideoRecordingAction();
        }
    }, videoConfig.maxDuration);
}

function updateRecordingTimer() {
    if (!isRecordingVideo) return;
    
    const elapsed = Date.now() - recordingStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    document.getElementById('videoTimer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    if (elapsed > videoConfig.maxDuration - 10000) {
        document.getElementById('videoTimer').style.color = '#ef4444';
        document.getElementById('videoTimer').style.animation = 'pulse 1s infinite';
    }
}

function stopVideoRecordingAction(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (!isRecordingVideo || !videoRecorder) return;
    
    videoRecorder.stop();
    isRecordingVideo = false;
    
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    
    document.getElementById('recordingIndicator').style.display = 'none';
    document.getElementById('videoRecordBtn').classList.remove('recording');
    document.getElementById('videoRecordOverlay').style.display = 'none';
    
    document.removeEventListener('mouseup', stopVideoRecordingAction);
    document.removeEventListener('touchend', stopVideoRecordingAction);
    
    showNotification('Р’РёРґРµРѕСЃРѕРѕР±С‰РµРЅРёРµ РѕС‚РїСЂР°РІР»СЏРµС‚СЃСЏ...', '');
}

async function toggleCamera() {
    if (!videoStream) return;
    
    videoStream.getTracks().forEach(track => track.stop());
    
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    
    await startVideoRecording();
}

function cleanupVideoRecording() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    videoRecorder = null;
    videoChunks = [];
    isRecordingVideo = false;
    
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    
    const videoPreview = document.getElementById('videoPreview');
    if (videoPreview) {
        videoPreview.srcObject = null;
    }
}

function cancelVideoRecording() {
    if (videoRecorder && videoRecorder.state !== 'inactive') {
        videoRecorder.stop();
    }
    
    cleanupVideoRecording();
    document.getElementById('videoRecordOverlay').style.display = 'none';
    document.getElementById('recordTypeMenu').classList.remove('active');
}

async function sendVideoMessage(videoData) {
    if (!checkConnection() || !currentChatId || !chatRef) {
        showError('РќРµРІРѕР·РјРѕР¶РЅРѕ РѕС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ');
        return;
    }
    
    showLoading();
    
    try {
        const message = {
            from: username,
            text: 'рџЋҐ Р’РёРґРµРѕСЃРѕРѕР±С‰РµРЅРёРµ',
            video: videoData,
            time: Date.now(),
            sent: true,
            delivered: true,
            read: false,
            status: 'sent',
            type: 'video_message',
            duration: Math.floor((Date.now() - recordingStartTime) / 1000)
        };
        
        await chatRef.push(message);
        showNotification('РЈСЃРїРµС€РЅРѕ', 'Р’РёРґРµРѕСЃРѕРѕР±С‰РµРЅРёРµ РѕС‚РїСЂР°РІР»РµРЅРѕ!');
        
        if (typeof playSendSound === 'function') {
            playSendSound();
        }
        
    } catch (error) {
        console.error('РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё РІРёРґРµРѕСЃРѕРѕР±С‰РµРЅРёСЏ:', error);
        showError('РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РІРёРґРµРѕСЃРѕРѕР±С‰РµРЅРёРµ', () => sendVideoMessage(videoData));
    } finally {
        hideLoading();
    }
}


function playVideoMessage(videoUrl) {
    const modal = document.createElement('div');
    modal.className = 'video-playback-overlay';
    modal.innerHTML = `
        <div class="video-playback-modal">
            <button class="close-btn" onclick="this.parentElement.parentElement.remove()">вњ•</button>
            <video src="${videoUrl}" controls autoplay></video>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function initVideoMessagesAfterLogin() {
    setTimeout(() => {
        if (initVideoMessages()) {
            console.log('Р’РёРґРµРѕСЃРѕРѕР±С‰РµРЅРёСЏ РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°РЅС‹');
        }
    }, 500);
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof username !== 'undefined' && username) {
        setTimeout(initVideoMessages, 1000);
    }
});
