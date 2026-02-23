// ===== ПОДСЧЁТ ПОЛЬЗОВАТЕЛЕЙ ИЗ FIREBASE =====
function initUserCounter() {
    // Используем глобальный db из firebase-config.js
    const usersRef = window.db?.ref('users');
    
    if (!usersRef) {
        // Если Firebase не подключён, показываем скромные демо-числа
        animateCounter('userCount', 12, 2000);
        animateCounter('totalUsers', 48, 2000);
        return;
    }

    const userCountEl = document.getElementById('userCount');
    const totalUsersEl = document.getElementById('totalUsers');

    // Подсчёт всех пользователей
    usersRef.once('value', (snapshot) => {
        const users = snapshot.val();
        if (users) {
            const totalUsers = Object.keys(users).length;
            animateCounter('totalUsers', totalUsers, 2000);
            
            // Подсчёт онлайн пользователей
            const onlineUsers = Object.values(users).filter(u => u.online === true).length;
            animateCounter('userCount', onlineUsers || 1, 1500);
        } else {
            // Если база пустая
            animateCounter('userCount', 1, 2000);
            animateCounter('totalUsers', 0, 2000);
        }
    }).catch(() => {
        // При ошибке показываем скромные числа
        animateCounter('userCount', 3, 2000);
        animateCounter('totalUsers', 15, 2000);
    });
}

// ===== НАВИГАЦИЯ =====
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

// Эффект скролла для навбара
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Мобильное меню
navToggle?.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    navToggle.classList.toggle('active');
});

// Закрытие меню при клике на ссылку
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    });
});

// ===== FAQ АККОРДЕОН =====
document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
        const item = question.parentElement;
        const isActive = item.classList.contains('active');
        
        // Закрыть все остальные
        document.querySelectorAll('.faq-item').forEach(faq => {
            faq.classList.remove('active');
        });
        
        // Открыть/закрыть текущий
        if (!isActive) {
            item.classList.add('active');
        }
    });
});

// ===== ПЛАВНЫЙ СКРОЛЛ =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href.length > 1) {
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const offset = 80;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - offset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// ===== АНИМАЦИИ ПРИ СКРОЛЛЕ =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Применяем анимацию ко всем карточкам
document.querySelectorAll('.feature-card, .benefit-card, .download-card, .security-item, .faq-item, .stat-card, .screenshot-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// ===== ПОДСЧЁТ ПОЛЬЗОВАТЕЛЕЙ ИЗ FIREBASE =====
function initUserCounter() {
    if (!database) {
        // Если Firebase не подключён, показываем демо-числа
        animateCounter('userCount', 1247, 2000);
        animateCounter('totalUsers', 5832, 2000);
        return;
    }

    const userCountEl = document.getElementById('userCount');
    const totalUsersEl = document.getElementById('totalUsers');

    // Подсчёт онлайн пользователей
    const usersRef = database.ref('users');
    usersRef.on('value', (snapshot) => {
        const users = snapshot.val();
        if (users) {
            const onlineUsers = Object.values(users).filter(u => u.online === true).length;
            animateCounter('userCount', onlineUsers, 1500);
        } else {
            animateCounter('userCount', 1247, 2000);
        }
    });

    // Подсчёт всех пользователей
    usersRef.once('value', (snapshot) => {
        const users = snapshot.val();
        if (users) {
            const totalUsers = Object.keys(users).length;
            animateCounter('totalUsers', totalUsers, 2000);
        } else {
            animateCounter('totalUsers', 5832, 2000);
        }
    });
}

// Анимация счётчика
function animateCounter(elementId, endValue, duration) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startValue = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out-quart)
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        
        const currentValue = Math.floor(startValue + (endValue - startValue) * easeProgress);
        
        // Форматирование числа с пробелами (1 000)
        element.textContent = currentValue.toLocaleString('ru-RU');
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ===== ПАРАЛЛАКС ЭФФЕКТ ДЛЯ ГРАДИЕНТНЫХ ШАРОВ =====
document.addEventListener('mousemove', (e) => {
    const orbs = document.querySelectorAll('.gradient-orb');
    const mouseX = e.clientX / window.innerWidth;
    const mouseY = e.clientY / window.innerHeight;
    
    orbs.forEach((orb, index) => {
        const speed = (index + 1) * 15;
        const x = (mouseX - 0.5) * speed * 20;
        const y = (mouseY - 0.5) * speed * 20;
        orb.style.transform = `translate(${x}px, ${y}px)`;
    });
});

// ===== АКТИВНАЯ ССЫЛКА В МЕНЮ =====
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    
    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-menu a[href="#${sectionId}"]`);
        
        if (navLink) {
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLink.classList.add('active');
            } else {
                navLink.classList.remove('active');
            }
        }
    });
});

// ===== ЗАГРУЗКА СТРАНИЦЫ =====
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    
    // Запуск счётчика пользователей
    initUserCounter();
    
    // Анимация появления hero-секции
    const heroContent = document.querySelector('.hero-content');
    const heroImage = document.querySelector('.hero-image');
    
    if (heroContent) {
        heroContent.style.opacity = '0';
        heroContent.style.transform = 'translateY(30px)';
        setTimeout(() => {
            heroContent.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            heroContent.style.opacity = '1';
            heroContent.style.transform = 'translateY(0)';
        }, 100);
    }
    
    if (heroImage) {
        heroImage.style.opacity = '0';
        heroImage.style.transform = 'translateX(30px)';
        setTimeout(() => {
            heroImage.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            heroImage.style.opacity = '1';
            heroImage.style.transform = 'translateX(0)';
        }, 300);
    }
});

// ===== КНОПКА "НАВЕРХ" =====
const createBackToTopButton = () => {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.innerHTML = '↑';
    btn.setAttribute('aria-label', 'Наверх');
    document.body.appendChild(btn);
    
    const updateButton = () => {
        if (window.scrollY > 500) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    };
    
    btn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    window.addEventListener('scroll', updateButton);
    updateButton();
};

createBackToTopButton();

// ===== КОНСОЛЬНОЕ ПРИВЕТСТВИЕ =====
console.log('%c RuChat Landing Page ', 'background: linear-gradient(135deg, #0088cc, #0ea5e9); color: white; font-size: 20px; padding: 10px 20px; border-radius: 8px;');
console.log('%c Современный мессенджер для свободного общения ', 'color: #64748b; font-size: 14px;');
console.log('%c Веб-версия: https://web-messenger-1694a.web.app ', 'color: #0088cc; font-size: 12px;');
