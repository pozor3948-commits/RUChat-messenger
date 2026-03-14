/**
 * RuChat - Core Functions
 * Объединённый файл для быстрой загрузки
 * Версия: 1.6.2
 */

// Быстрая инициализация критических функций
(function() {
    'use strict';
    
    // Проверка наличия Firebase
    if (typeof firebase === 'undefined') {
        console.error('[RuChat] Firebase SDK не загружен!');
        return;
    }
    
    // Глобальные переменные
    window.ruchat = window.ruchat || {};
    window.ruchat.version = '1.6.2';
    window.ruchat.loaded = false;
    
    // Критические функции
    window.ruchat.showError = function(msg, retry) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(msg, 'Ошибка', 'error');
        } else {
            alert('Ошибка: ' + msg);
        }
        if (retry) window.retryAction = retry;
    };
    
    window.ruchat.showLoading = function() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'flex';
    };
    
    window.ruchat.hideLoading = function() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    };
    
    // Проверка соединения
    window.ruchat.checkConnection = function() {
        if (!navigator.onLine) {
            window.ruchat.showError('Нет подключения к интернету');
            return false;
        }
        return true;
    };
    
    // Инициализация после загрузки всех скриптов
    window.addEventListener('load', function() {
        window.ruchat.loaded = true;
        console.log('[RuChat] Core v' + window.ruchat.version + ' loaded');
        
        // Автобекап ОТКЛЮЧЕН для предотвращения ошибок
        // if (typeof window.autoBackup === 'function') {
        //     setTimeout(function() {
        //         window.autoBackup();
        //     }, 5000);
        // }
    });
    
    // Обработка ошибок (не спамим)
    let errorCount = 0;
    window.addEventListener('error', function(e) {
        errorCount++;
        if (errorCount <= 5) {  // Показываем только первые 5 ошибок
            console.error('[RuChat Error]', e.filename + ':' + e.lineno, e.message);
        }
    });
    
    window.addEventListener('unhandledrejection', function(e) {
        // Игнорируем ошибки Firebase (permission denied)
        if (e.reason && e.reason.code === 'PERMISSION_DENIED') {
            return;
        }
        // Игнорируем ошибки Service Worker
        if (e.reason && e.reason.message && e.reason.message.includes('service worker')) {
            return;
        }
        console.error('[RuChat Promise Error]', e.reason);
    });
    
})();
