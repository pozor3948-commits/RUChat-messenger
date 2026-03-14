/* ==========================================================
   РЕЗЕРВНОЕ КОПИРОВАНИЕ И ВОССТАНОВЛЕНИЕ ДАННЫХ
   ========================================================== */

// Создать резервную копию данных пользователя
async function createBackup() {
    if (!username) {
        showError('Сначала войдите в аккаунт');
        return null;
    }

    showLoading();
    try {
        // Получаем все данные пользователя
        const snapshot = await db.ref(`accounts/${username}`).get();
        
        if (!snapshot.exists()) {
            throw new Error('Аккаунт не найден');
        }

        const accountData = snapshot.val();
        
        // Получаем чаты
        const privateChatsSnapshot = await db.ref('privateChats').orderByKey()
            .startAt(`${username}_`)
            .endAt(`${username}_\uf8ff`)
            .get();
        
        const privateChats = {};
        if (privateChatsSnapshot.exists()) {
            privateChatsSnapshot.forEach(child => {
                privateChats[child.key] = child.val();
            });
        }

        // Получаем групповые чаты
        const userGroupsSnapshot = await db.ref(`usersGroups/${username}`).get();
        const groupChats = {};
        
        if (userGroupsSnapshot.exists()) {
            const groupIds = userGroupsSnapshot.val();
            for (const groupId of Object.keys(groupIds)) {
                const groupSnapshot = await db.ref(`groupChats/${groupId}`).get();
                if (groupSnapshot.exists()) {
                    groupChats[groupId] = groupSnapshot.val();
                }
            }
        }

        // Создаем объект резервной копии
        const backup = {
            version: '1.0',
            username: username,
            createdAt: Date.now(),
            timestamp: new Date().toISOString(),
            data: {
                account: accountData,
                privateChats: privateChats,
                groupChats: groupChats
            }
        };

        // Сохраняем в Firebase (для синхронизации между устройствами)
        const backupId = `backup_${Date.now()}`;
        await db.ref(`backups/${username}/${backupId}`).set({
            createdAt: Date.now(),
            size: JSON.stringify(backup).length,
            version: backup.version
        });

        // Сохраняем локально в localStorage (ограничение ~5-10MB)
        try {
            localStorage.setItem(`ruchat_backup_${username}`, JSON.stringify(backup));
            localStorage.setItem('ruchat_backup_timestamp', Date.now().toString());
        } catch (e) {
            console.warn('[Backup] Не удалось сохранить в localStorage:', e);
        }

        hideLoading();
        showNotification('Резервная копия', 'Создана успешно!', 'success');
        
        // Скачиваем файл
        downloadBackup(backup);
        
        return backup;
        
    } catch (error) {
        console.error('[Backup] Ошибка создания резервной копии:', error);
        hideLoading();
        showError('Ошибка: ' + error.message);
        return null;
    }
}

// Скачать резервную копию в файл
function downloadBackup(backup) {
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ruchat_backup_${username}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Восстановить из резервной копии
async function restoreBackup(backupData) {
    if (!username) {
        showError('Сначала войдите в аккаунт');
        return false;
    }

    showLoading();
    try {
        // Проверяем формат резервной копии
        if (!backupData.version || !backupData.data) {
            throw new Error('Неверный формат резервной копии');
        }

        if (backupData.username !== username) {
            const confirmRestore = confirm(
                `Резервная копия создана для пользователя "${backupData.username}".\n` +
                `Восстановить данные для текущего пользователя "${username}"?`
            );
            if (!confirmRestore) {
                hideLoading();
                return false;
            }
        }

        // Восстанавливаем данные аккаунта
        const accountData = backupData.data.account || {};
        await db.ref(`accounts/${username}`).update({
            displayName: accountData.displayName || username,
            about: accountData.about || '',
            avatar: accountData.avatar || '',
            friends: accountData.friends || {},
            blocked: accountData.blocked || {},
            chatThemes: accountData.chatThemes || {},
            restoredAt: Date.now()
        });

        // Восстанавливаем приватные чаты
        if (backupData.data.privateChats) {
            const updates = {};
            Object.keys(backupData.data.privateChats).forEach(chatId => {
                updates[`privateChats/${chatId}`] = backupData.data.privateChats[chatId];
            });
            await db.ref().update(updates);
        }

        // Восстанавливаем групповые чаты
        if (backupData.data.groupChats) {
            const updates = {};
            Object.keys(backupData.data.groupChats).forEach(groupId => {
                updates[`groupChats/${groupId}`] = backupData.data.groupChats[groupId];
                updates[`usersGroups/${username}/${groupId}`] = true;
            });
            await db.ref().update(updates);
        }

        hideLoading();
        showNotification('Восстановление', 'Данные успешно восстановлены!', 'success');
        
        // Перезагружаем страницу для применения изменений
        setTimeout(() => window.location.reload(), 1500);
        
        return true;
        
    } catch (error) {
        console.error('[Restore] Ошибка восстановления:', error);
        hideLoading();
        showError('Ошибка: ' + error.message);
        return false;
    }
}

// Загрузить резервную копию из файла
function loadBackupFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const backup = JSON.parse(text);
            
            const confirmRestore = confirm(
                `Восстановить из резервной копии от ${new Date(backup.createdAt).toLocaleString()}?\n` +
                `Все текущие данные будут заменены.`
            );
            
            if (confirmRestore) {
                await restoreBackup(backup);
            }
        } catch (error) {
            showError('Ошибка чтения файла: ' + error.message);
        }
    };
    
    input.click();
}

// Проверить наличие локальной резервной копии
function checkLocalBackup() {
    if (!username) return null;
    
    const backupStr = localStorage.getItem(`ruchat_backup_${username}`);
    if (!backupStr) return null;
    
    try {
        return JSON.parse(backupStr);
    } catch (e) {
        console.error('[Backup] Ошибка чтения локальной копии:', e);
        return null;
    }
}

// Автоматическое резервное копирование (раз в 7 дней)
function autoBackup() {
    if (!username) return;
    
    const lastBackup = localStorage.getItem('ruchat_last_backup');
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    if (!lastBackup || (now - parseInt(lastBackup)) > sevenDays) {
        console.log('[Backup] Автоматическое резервное копирование...');
        createBackup().then(backup => {
            if (backup) {
                localStorage.setItem('ruchat_last_backup', now.toString());
            }
        });
    }
}

// Экспорт функций
window.createBackup = createBackup;
window.restoreBackup = restoreBackup;
window.loadBackupFromFile = loadBackupFromFile;
window.checkLocalBackup = checkLocalBackup;
window.autoBackup = autoBackup;
