[file name]: stories.js
[file content begin]
/* ==========================================================
   Р¤РЈРќРљР¦РР Р”Р›РЇ РРЎРўРћР РР™ (Instagram-like)
   ========================================================== */

// Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ РґР»СЏ РёСЃС‚РѕСЂРёР№
let currentStoryFile = null;
let currentStoryType = null;
let storyViewerInterval = null;
let currentStoryIndex = 0;
let currentUserStories = [];
let storyProgressInterval = null;
let viewedStories = {};

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
function getCurrentUser() {
    return window.username || username || '';
}

// Р“Р›РћР‘РђР›Р¬РќРђРЇ Р¤РЈРќРљР¦РРЇ loadStories
function loadStories() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        console.warn("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёСЃС‚РѕСЂРёРё: РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ");
        return;
    }
    
    const sl = document.getElementById("storiesList");
    if (!sl) {
        console.error("Р­Р»РµРјРµРЅС‚ storiesList РЅРµ РЅР°Р№РґРµРЅ");
        return;
    }
    
    // РћС‡РёС‰Р°РµРј СЃРїРёСЃРѕРє
    sl.innerHTML = '';
    
    // Р”РѕР±Р°РІР»СЏРµРј РєРЅРѕРїРєСѓ СЃРѕР·РґР°РЅРёСЏ СЃРІРѕРµР№ РёСЃС‚РѕСЂРёРё
    addMyStoryButton(sl);
    
    // Р—Р°РіСЂСѓР¶Р°РµРј РёСЃС‚РѕСЂРёРё РґСЂСѓР·РµР№
    db.ref("accounts/" + currentUser + "/friends").once("value").then(snap => {
        if (!snap.exists()) {
            return;
        }
        
        let friendIndex = 0;
        const friends = [];
        snap.forEach(ch => {
            friends.push(ch.key);
        });
        
        // Р—Р°РіСЂСѓР¶Р°РµРј РёСЃС‚РѕСЂРёРё РєР°Р¶РґРѕРіРѕ РґСЂСѓРіР°
        friends.forEach(friendName => {
            setTimeout(() => {
                db.ref(`accounts/${friendName}/stories`)
                    .orderByChild('timestamp')
                    .startAt(Date.now() - 24 * 60 * 60 * 1000)
                    .once("value", storiesSnap => {
                        if (storiesSnap.exists() && storiesSnap.numChildren() > 0) {
                            createFriendStoryItem(friendName, storiesSnap);
                        }
                    });
            }, friendIndex * 100);
            friendIndex++;
        });
    });
}

// РџРѕРєР°Р·Р°С‚СЊ РјРѕРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ СЃРѕР·РґР°РЅРёСЏ РёСЃС‚РѕСЂРёРё
function showCreateStoryModal() {
    if (!checkConnection()) return;
    document.getElementById('storyModalOverlay').style.display = 'flex';
}

// Р—Р°РєСЂС‹С‚СЊ РјРѕРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ СЃРѕР·РґР°РЅРёСЏ РёСЃС‚РѕСЂРёРё
function closeStoryModal() {
    document.getElementById('storyModalOverlay').style.display = 'none';
}

// РЎРѕР·РґР°С‚СЊ С„РѕС‚Рѕ-РёСЃС‚РѕСЂРёСЋ
function createPhotoStory() {
    closeStoryModal();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => handleStoryFileSelected(e.target.files[0], 'photo');
    input.click();
}

// РЎРѕР·РґР°С‚СЊ РІРёРґРµРѕ-РёСЃС‚РѕСЂРёСЋ
function createVideoStory() {
    closeStoryModal();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = (e) => handleStoryFileSelected(e.target.files[0], 'video');
    input.click();
}

// РћР±СЂР°Р±РѕС‚РєР° РІС‹Р±СЂР°РЅРЅРѕРіРѕ С„Р°Р№Р»Р° РґР»СЏ РёСЃС‚РѕСЂРёРё
function handleStoryFileSelected(file, type) {
    if (!file) return;
    
    // РџСЂРѕРІРµСЂРєР° СЂР°Р·РјРµСЂР° С„Р°Р№Р»Р°
    const maxSize = type === 'photo' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
        showError(`Р¤Р°Р№Р» СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕР№. РњР°РєСЃРёРјР°Р»СЊРЅС‹Р№ СЂР°Р·РјРµСЂ: ${type === 'photo' ? '10MB' : '50MB'}`);
        return;
    }
    
    currentStoryFile = file;
    currentStoryType = type;
    
    // РџРѕРєР°Р·Р°С‚СЊ РїСЂРµРІСЊСЋ
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewContent = document.getElementById('storyPreviewContent');
        previewContent.innerHTML = '';
        
        if (type === 'photo') {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            previewContent.appendChild(img);
        } else if (type === 'video') {
            const video = document.createElement('video');
            video.src = e.target.result;
            video.controls = true;
            video.autoplay = true;
            video.muted = true;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';
            previewContent.appendChild(video);
        }
        
        document.getElementById('storyPreviewOverlay').style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

// Р—Р°РєСЂС‹С‚СЊ РїСЂРµРІСЊСЋ РёСЃС‚РѕСЂРёРё
function closeStoryPreview() {
    document.getElementById('storyPreviewOverlay').style.display = 'none';
    currentStoryFile = null;
    currentStoryType = null;
}

// РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ РёСЃС‚РѕСЂРёСЋ
async function publishStory() {
    if (!currentStoryFile || !currentStoryType) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showError("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ");
        return;
    }
    
    showLoading();
    
    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const storyData = {
                type: currentStoryType,
                url: e.target.result,
                timestamp: Date.now(),
                duration: currentStoryType === 'video' ? await getVideoDuration(currentStoryFile) : 0,
                views: {}
            };
            
            // РЎРѕС…СЂР°РЅСЏРµРј РёСЃС‚РѕСЂРёСЋ РІ Firebase
            const storyKey = `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.ref(`accounts/${currentUser}/stories/${storyKey}`).set(storyData);
            
            // РџРѕРјРµС‡Р°РµРј РёСЃС‚РѕСЂРёСЋ РєР°Рє РїСЂРѕСЃРјРѕС‚СЂРµРЅРЅСѓСЋ СЃР°РјРёРј РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј
            await db.ref(`accounts/${currentUser}/stories/${storyKey}/views/${currentUser}`).set(true);
            
            showNotification('РЈСЃРїРµС€РЅРѕ', 'РСЃС‚РѕСЂРёСЏ РѕРїСѓР±Р»РёРєРѕРІР°РЅР°!');
            closeStoryPreview();
            
            // РџРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј РёСЃС‚РѕСЂРёРё
            loadStories();
            
            // Р’РѕСЃРїСЂРѕРёР·РІРѕРґРёРј Р·РІСѓРє СѓСЃРїРµС…Р°
            if (typeof playSendSound === 'function') {
                playSendSound();
            }
        };
        reader.readAsDataURL(currentStoryFile);
    } catch (error) {
        console.error('РћС€РёР±РєР° РїСЂРё РїСѓР±Р»РёРєР°С†РёРё РёСЃС‚РѕСЂРёРё:', error);
        showError('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСѓР±Р»РёРєРѕРІР°С‚СЊ РёСЃС‚РѕСЂРёСЋ');
    } finally {
        hideLoading();
    }
}

// РџРѕР»СѓС‡РёС‚СЊ РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ РІРёРґРµРѕ
function getVideoDuration(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = function() {
            window.URL.revokeObjectURL(video.src);
            resolve(Math.round(video.duration));
        };
        video.src = URL.createObjectURL(file);
    });
}

// Р”РѕР±Р°РІРёС‚СЊ РєРЅРѕРїРєСѓ СЃРІРѕРµР№ РёСЃС‚РѕСЂРёРё
function addMyStoryButton(container) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const myStoryItem = document.createElement("div");
    myStoryItem.className = "story-item story-add-btn";
    myStoryItem.onclick = showCreateStoryModal;
    
    // РџРѕР»СѓС‡Р°РµРј URL СЃРІРѕРµРіРѕ Р°РІР°С‚Р°СЂР°
    const myAvatar = document.getElementById('userAvatar');
    const avatarUrl = myAvatar && myAvatar.src ? myAvatar.src : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser)}&background=0088cc&color=fff&size=60`;
    
    myStoryItem.innerHTML = `
        <div class="story-avatar-container">
            <img class="story-avatar" src="${avatarUrl}" alt="${currentUser}">
            <div class="story-add-icon">+</div>
        </div>
        <div class="story-name">Р’Р°С€Р° РёСЃС‚РѕСЂРёСЏ</div>
    `;
    
    container.appendChild(myStoryItem);
}

// РЎРѕР·РґР°С‚СЊ СЌР»РµРјРµРЅС‚ РёСЃС‚РѕСЂРёРё РґСЂСѓРіР°
function createFriendStoryItem(friendName, storiesSnap) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const sl = document.getElementById("storiesList");
    if (!sl) return;
    
    // РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё РЅРµРїСЂРѕСЃРјРѕС‚СЂРµРЅРЅС‹Рµ РёСЃС‚РѕСЂРёРё
    let hasUnviewed = false;
    let latestStoryTime = 0;
    
    storiesSnap.forEach(storySnap => {
        const story = storySnap.val();
        if (story.timestamp > latestStoryTime) {
            latestStoryTime = story.timestamp;
        }
        if (!story.views || !story.views[currentUser]) {
            hasUnviewed = true;
        }
    });
    
    // РџРѕРєР°Р·С‹РІР°РµРј С‚РѕР»СЊРєРѕ РёСЃС‚РѕСЂРёРё РјР»Р°РґС€Рµ 24 С‡Р°СЃРѕРІ
    if (Date.now() - latestStoryTime > 24 * 60 * 60 * 1000) {
        return;
    }
    
    const storyItem = document.createElement("div");
    storyItem.className = `story-item ${hasUnviewed ? 'unviewed' : 'viewed'}`;
    storyItem.onclick = () => viewFriendStories(friendName);
    
    // РџРѕР»СѓС‡Р°РµРј Р°РІР°С‚Р°СЂ РґСЂСѓРіР°
    const friendAvatar = document.getElementById(`avatar_${friendName}`);
    const avatarUrl = friendAvatar && friendAvatar.src ? friendAvatar.src : `https://ui-avatars.com/api/?name=${encodeURIComponent(friendName)}&background=0088cc&color=fff&size=60`;
    
    storyItem.innerHTML = `
        <img class="story-avatar" src="${avatarUrl}" alt="${friendName}">
        <div class="story-name">${friendName}</div>
    `;
    
    sl.appendChild(storyItem);
}

// РџСЂРѕСЃРјРѕС‚СЂ РёСЃС‚РѕСЂРёР№ РґСЂСѓРіР°
async function viewFriendStories(friendName) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showError("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ");
        return;
    }
    
    showLoading();
    
    try {
        const storiesSnap = await db.ref(`accounts/${friendName}/stories`)
            .orderByChild('timestamp')
            .startAt(Date.now() - 24 * 60 * 60 * 1000)
            .once("value");
        
        if (!storiesSnap.exists()) {
            showNotification('РСЃС‚РѕСЂРёРё', 'РЈ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅРµС‚ Р°РєС‚РёРІРЅС‹С… РёСЃС‚РѕСЂРёР№');
            return;
        }
        
        currentUserStories = [];
        storiesSnap.forEach(storySnap => {
            const story = storySnap.val();
            story.key = storySnap.key;
            story.author = friendName;
            currentUserStories.push(story);
        });
        
        // РЎРѕСЂС‚РёСЂСѓРµРј РїРѕ РІСЂРµРјРµРЅРё (РѕС‚ СЃС‚Р°СЂС‹С… Рє РЅРѕРІС‹Рј)
        currentUserStories.sort((a, b) => a.timestamp - b.timestamp);
        
        if (currentUserStories.length > 0) {
            currentStoryIndex = 0;
            showStoryViewer();
            
            // РћС‚РјРµС‡Р°РµРј РєР°Рє РїСЂРѕСЃРјРѕС‚СЂРµРЅРЅСѓСЋ
            await markStoryAsViewed(friendName, currentUserStories[currentStoryIndex].key);
        }
    } catch (error) {
        console.error('РћС€РёР±РєР° РїСЂРё Р·Р°РіСЂСѓР·РєРµ РёСЃС‚РѕСЂРёР№:', error);
        showError('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёСЃС‚РѕСЂРёРё');
    } finally {
        hideLoading();
    }
}

// РџРѕРєР°Р·Р°С‚СЊ РїСЂРѕСЃРјРѕС‚СЂС‰РёРє РёСЃС‚РѕСЂРёР№
function showStoryViewer() {
    if (currentUserStories.length === 0) return;
    
    const story = currentUserStories[currentStoryIndex];
    const currentUser = getCurrentUser();
    
    // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ Р°РІС‚РѕСЂРµ
    document.getElementById('storyViewerName').textContent = story.author;
    document.getElementById('storyViewerTime').textContent = formatStoryTime(story.timestamp);
    
    // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј Р°РІР°С‚Р°СЂ
    const friendAvatar = document.getElementById(`avatar_${story.author}`);
    const avatarUrl = friendAvatar && friendAvatar.src ? friendAvatar.src : `https://ui-avatars.com/api/?name=${encodeURIComponent(story.author)}&background=0088cc&color=fff&size=40`;
    const avatarImg = document.getElementById('storyViewerAvatar');
    avatarImg.src = avatarUrl;
    avatarImg.onerror = function() {
        this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(story.author)}&background=0088cc&color=fff&size=40`;
    };
    
    // РћС‚РѕР±СЂР°Р¶Р°РµРј РєРѕРЅС‚РµРЅС‚
    const contentDiv = document.getElementById('storyViewerContent');
    contentDiv.innerHTML = '';
    
    if (story.type === 'photo') {
        const img = document.createElement('img');
        img.src = story.url;
        img.alt = 'РСЃС‚РѕСЂРёСЏ';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        contentDiv.appendChild(img);
    } else if (story.type === 'video') {
        const video = document.createElement('video');
        video.src = story.url;
        video.controls = true;
        video.autoplay = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        video.onended = nextStory;
        contentDiv.appendChild(video);
    }
    
    // РџРѕРєР°Р·С‹РІР°РµРј РїСЂРѕРіСЂРµСЃСЃ Р±Р°СЂ
    showStoryProgress();
    
    // РџРѕРєР°Р·С‹РІР°РµРј РїСЂРѕСЃРјРѕС‚СЂС‰РёРє
    document.getElementById('storyViewerOverlay').style.display = 'flex';
    
    // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РїРµСЂРµРєР»СЋС‡РµРЅРёРµ С‡РµСЂРµР· 5 СЃРµРєСѓРЅРґ РґР»СЏ С„РѕС‚Рѕ
    if (story.type === 'photo') {
        startStoryTimer(5000);
    }
    
    // Р”РѕР±Р°РІР»СЏРµРј РѕР±СЂР°Р±РѕС‚С‡РёРєРё Р¶РµСЃС‚РѕРІ
    setupStoryGestures();
}

// РџРѕРєР°Р·Р°С‚СЊ РїСЂРѕРіСЂРµСЃСЃ Р±Р°СЂ
function showStoryProgress() {
    const progressBar = document.getElementById('storyProgressBar');
    progressBar.innerHTML = '';
    
    for (let i = 0; i < currentUserStories.length; i++) {
        const segment = document.createElement('div');
        segment.className = 'story-progress-segment';
        segment.style.flex = '1';
        segment.style.height = '4px';
        segment.style.margin = '0 2px';
        segment.style.backgroundColor = i < currentStoryIndex ? 'white' : 'rgba(255,255,255,.3)';
        segment.style.borderRadius = '2px';
        segment.style.overflow = 'hidden';
        progressBar.appendChild(segment);
        
        if (i === currentStoryIndex) {
            const fill = document.createElement('div');
            fill.style.width = '0%';
            fill.style.height = '100%';
            fill.style.backgroundColor = 'white';
            fill.style.transition = `width ${currentUserStories[i].type === 'photo' ? 5 : currentUserStories[i].duration || 10}s linear`;
            segment.appendChild(fill);
            
            // Р—Р°РїСѓСЃРєР°РµРј Р°РЅРёРјР°С†РёСЋ
            setTimeout(() => {
                fill.style.width = '100%';
            }, 10);
        }
    }
}

// Р—Р°РїСѓСЃС‚РёС‚СЊ С‚Р°Р№РјРµСЂ РґР»СЏ РёСЃС‚РѕСЂРёРё
function startStoryTimer(duration) {
    if (storyViewerInterval) clearInterval(storyViewerInterval);
    storyViewerInterval = setTimeout(nextStory, duration);
}

// РЎР»РµРґСѓСЋС‰Р°СЏ РёСЃС‚РѕСЂРёСЏ
function nextStory() {
    if (currentStoryIndex < currentUserStories.length - 1) {
        currentStoryIndex++;
        showStoryViewer();
        
        // РћС‚РјРµС‡Р°РµРј РєР°Рє РїСЂРѕСЃРјРѕС‚СЂРµРЅРЅСѓСЋ
        markStoryAsViewed(currentUserStories[currentStoryIndex].author, currentUserStories[currentStoryIndex].key);
    } else {
        closeStoryViewer();
    }
}

// РџСЂРµРґС‹РґСѓС‰Р°СЏ РёСЃС‚РѕСЂРёСЏ
function prevStory() {
    if (currentStoryIndex > 0) {
        currentStoryIndex--;
        showStoryViewer();
    }
}

// Р—Р°РєСЂС‹С‚СЊ РїСЂРѕСЃРјРѕС‚СЂС‰РёРє РёСЃС‚РѕСЂРёР№
function closeStoryViewer() {
    document.getElementById('storyViewerOverlay').style.display = 'none';
    if (storyViewerInterval) clearInterval(storyViewerInterval);
    storyViewerInterval = null;
    currentUserStories = [];
    currentStoryIndex = 0;
}

// РћС‚РјРµС‚РёС‚СЊ РёСЃС‚РѕСЂРёСЋ РєР°Рє РїСЂРѕСЃРјРѕС‚СЂРµРЅРЅСѓСЋ
async function markStoryAsViewed(author, storyKey) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
        await db.ref(`accounts/${author}/stories/${storyKey}/views/${currentUser}`).set(true);
        
        // РћР±РЅРѕРІР»СЏРµРј РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РёСЃС‚РѕСЂРёР№
        const storyItems = document.querySelectorAll('.story-item');
        storyItems.forEach(item => {
            if (item.onclick && item.onclick.toString().includes(author)) {
                item.classList.remove('unviewed');
                item.classList.add('viewed');
            }
        });
    } catch (error) {
        console.error('РћС€РёР±РєР° РїСЂРё РѕС‚РјРµС‚РєРµ РёСЃС‚РѕСЂРёРё:', error);
    }
}

// Р¤РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РІСЂРµРјРµРЅРё РёСЃС‚РѕСЂРёРё
function formatStoryTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) {
        return 'С‚РѕР»СЊРєРѕ С‡С‚Рѕ';
    } else if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} ${getMinutesText(minutes)} РЅР°Р·Р°Рґ`;
    } else if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} ${getHoursText(hours)} РЅР°Р·Р°Рґ`;
    } else {
        const date = new Date(timestamp);
        return date.toLocaleDateString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

function getMinutesText(minutes) {
    if (minutes % 10 === 1 && minutes % 100 !== 11) return 'РјРёРЅСѓС‚Сѓ';
    if ([2, 3, 4].includes(minutes % 10) && ![12, 13, 14].includes(minutes % 100)) return 'РјРёРЅСѓС‚С‹';
    return 'РјРёРЅСѓС‚';
}

function getHoursText(hours) {
    if (hours % 10 === 1 && hours % 100 !== 11) return 'С‡Р°СЃ';
    if ([2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours % 100)) return 'С‡Р°СЃР°';
    return 'С‡Р°СЃРѕРІ';
}

// РќР°СЃС‚СЂРѕР№РєР° Р¶РµСЃС‚РѕРІ РґР»СЏ РїСЂРѕСЃРјРѕС‚СЂР° РёСЃС‚РѕСЂРёР№
function setupStoryGestures() {
    const viewer = document.getElementById('storyViewerOverlay');
    let startX = 0;
    let startY = 0;
    
    viewer.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
    
    viewer.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        
        const diffX = endX - startX;
        const diffY = endY - startY;
        
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 50) {
                prevStory();
            } else if (diffX < -50) {
                nextStory();
            }
        } else if (diffY > 50) {
            closeStoryViewer();
        }
    });
    
    // РћР±СЂР°Р±РѕС‚РєР° РєР»РёРєРѕРІ РґР»СЏ РґРµСЃРєС‚РѕРїР°
    viewer.addEventListener('click', (e) => {
        const rect = viewer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        if (x < width / 3) {
            prevStory();
        } else if (x > width * 2 / 3) {
            nextStory();
        } else if (x > width / 3 && x < width * 2 / 3) {
            nextStory();
        }
    });
}

// РћС‡РёСЃС‚РєР° СЃС‚Р°СЂС‹С… РёСЃС‚РѕСЂРёР№ (СЃС‚Р°СЂС€Рµ 24 С‡Р°СЃРѕРІ)
async function cleanupOldStories() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    
    try {
        const storiesSnap = await db.ref(`accounts/${currentUser}/stories`).once("value");
        if (!storiesSnap.exists()) return;
        
        const updates = {};
        storiesSnap.forEach(storySnap => {
            const story = storySnap.val();
            if (story.timestamp < cutoffTime) {
                updates[`accounts/${currentUser}/stories/${storySnap.key}`] = null;
            }
        });
        
        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
        }
    } catch (error) {
        console.error('РћС€РёР±РєР° РїСЂРё РѕС‡РёСЃС‚РєРµ СЃС‚Р°СЂС‹С… РёСЃС‚РѕСЂРёР№:', error);
    }
}

// РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РёСЃС‚РѕСЂРёР№ РїРѕСЃР»Рµ РІС…РѕРґР°
function initStoriesAfterLogin() {
    // Р”Р°РµРј РІСЂРµРјСЏ РЅР° Р·Р°РіСЂСѓР·РєСѓ РґСЂСѓР·РµР№
    setTimeout(() => {
        // Р—Р°РіСЂСѓР¶Р°РµРј РёСЃС‚РѕСЂРёРё
        loadStories();
        
        // РћС‡РёС‰Р°РµРј СЃС‚Р°СЂС‹Рµ РёСЃС‚РѕСЂРёРё
        cleanupOldStories();
        
        // РџРµСЂРёРѕРґРёС‡РµСЃРєР°СЏ РѕС‡РёСЃС‚РєР° СЃС‚Р°СЂС‹С… РёСЃС‚РѕСЂРёР№ (РєР°Р¶РґС‹Р№ С‡Р°СЃ)
        setInterval(cleanupOldStories, 60 * 60 * 1000);
        
        // РџРµСЂРёРѕРґРёС‡РµСЃРєРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ РёСЃС‚РѕСЂРёР№ (РєР°Р¶РґС‹Рµ 30 СЃРµРєСѓРЅРґ)
        setInterval(loadStories, 30000);
    }, 2000);
}
[file content end]
