/* ══════════════════════════════════════════════════════════════
   MICHAEL JACKSON EVENT — mj-event.js
   À importer dans app.js :
     import { initMJEvent } from './mj-event.js';
     // Après initApp() :
     initMJEvent(db, auth);
══════════════════════════════════════════════════════════════ */

import {
    ref, onValue, get
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */
const MJ_QUOTES = [
    "I'll be there 🎤",
    "Heal the World 🌍",
    "Billie Jean n'est pas ma copine 🕺",
    "Hee-hee! 🎶",
    "Beat It — Événement Exclusif BlabChat",
    "Don't Stop 'Til You Get Enough ⭐",
    "Thriller Night sur BlabChat 🌙",
    "You Are Not Alone 💛",
    "Man In The Mirror 🪞",
    "Remember The Time — BlabChat × MJ",
    "Black or White 🤍🖤",
    "Moonwalk activé sur BlabChat 🌕",
];

const MJ_TICKER_ITEMS = [
    "🎤 ÉVÉNEMENT MICHAEL JACKSON",
    "🕺 THRILLER NIGHT",
    "⭐ BLABCHAT × THE KING OF POP",
    "🌙 MOONWALK EDITION",
    "🎶 HEE-HEE!",
    "🕺 BEAT IT",
    "💛 HEAL THE WORLD",
    "🎤 BILLIE JEAN",
    "🌍 WE ARE THE WORLD",
    "⭐ KING OF POP FOR EVER",
];

let _mjActive       = false;
let _introShown     = false;
let _particleLoop   = null;
let _thrillInterval = null;
let _particles      = [];

/* ─────────────────────────────────────────────
   INJECT HTML
───────────────────────────────────────────── */
function injectHTML() {
    // Banner
    if (!document.getElementById('mj-event-banner')) {
        const banner = document.createElement('div');
        banner.id = 'mj-event-banner';
        banner.innerHTML = `
            <div class="mj-banner-content">
                ${Array(3).fill(MJ_QUOTES.map(q =>
                    `<span class="mj-banner-star">✦</span>
                     <span class="mj-banner-text">${q}</span>`
                ).join('')).join('')}
            </div>
            <button class="mj-banner-close" onclick="document.getElementById('mj-event-banner').style.opacity='0'" title="Masquer">✕</button>
        `;
        document.body.appendChild(banner);
    }

    // Spotlights
    if (!document.getElementById('mj-spotlights')) {
        const sp = document.createElement('div');
        sp.id = 'mj-spotlights';
        sp.innerHTML = `
            <div class="mj-spotlight mj-spotlight-1"></div>
            <div class="mj-spotlight mj-spotlight-2"></div>
            <div class="mj-spotlight mj-spotlight-3"></div>
        `;
        document.body.appendChild(sp);
    }

    // Particles canvas
    if (!document.getElementById('mj-particles-canvas')) {
        const canvas = document.createElement('canvas');
        canvas.id = 'mj-particles-canvas';
        document.body.appendChild(canvas);
    }

    // Ticker
    if (!document.getElementById('mj-ticker')) {
        const ticker = document.createElement('div');
        ticker.id = 'mj-ticker';
        const items = [...MJ_TICKER_ITEMS, ...MJ_TICKER_ITEMS].map(t =>
            `<span class="mj-ticker-item">${t}</span><span class="mj-ticker-dot"></span>`
        ).join('');
        ticker.innerHTML = `<div class="mj-ticker-content">${items}</div>`;
        document.body.appendChild(ticker);
    }

    // Thriller overlay
    if (!document.getElementById('mj-thriller-overlay')) {
        const ov = document.createElement('div');
        ov.id = 'mj-thriller-overlay';
        document.body.appendChild(ov);
    }

    // Intro modal
    if (!document.getElementById('mj-intro-modal')) {
        const modal = document.createElement('div');
        modal.id = 'mj-intro-modal';
        modal.innerHTML = `
            <div class="mj-intro-bg"></div>
            <div class="mj-vinyl">💿</div>
            <div class="mj-intro-content">
                <div class="mj-intro-stars">
                    <span class="mj-intro-star">⭐</span>
                    <span class="mj-intro-star">✦</span>
                    <span class="mj-intro-star">⭐</span>
                    <span class="mj-intro-star">✦</span>
                    <span class="mj-intro-star">⭐</span>
                </div>
                <div class="mj-intro-silhouette">🕺</div>
                <div class="mj-intro-title">
                    <span>MICHAEL</span>
                    <span style="font-size:.6em;letter-spacing:20px;color:rgba(255,215,0,.5)">JACKSON</span>
                </div>
                <div class="mj-intro-tagline">— Événement Exclusif BlabChat —</div>
                <div class="mj-intro-dates">
                    <span></span>
                    THE KING OF POP
                    <span></span>
                </div>
                <button class="mj-intro-enter-btn" id="mj-intro-enter-btn">
                    ENTRER DANS LE CHAT ✦
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('mj-intro-enter-btn').onclick = closeMJIntro;
    }

    // Link CSS if not already done
    if (!document.getElementById('mj-event-css')) {
        const link = document.createElement('link');
        link.id   = 'mj-event-css';
        link.rel  = 'stylesheet';
        link.href = 'mj-event.css';
        document.head.appendChild(link);
    }
}

/* ─────────────────────────────────────────────
   INTRO MODAL
───────────────────────────────────────────── */
function openMJIntro() {
    const modal = document.getElementById('mj-intro-modal');
    if (!modal) return;
    modal.classList.add('visible');
    // Launch sparkle effect inside the intro
    setTimeout(() => launchIntroSparkles(), 500);
}

function closeMJIntro() {
    const modal = document.getElementById('mj-intro-modal');
    if (!modal) return;
    modal.style.transition = 'opacity .8s ease, transform .8s ease';
    modal.style.opacity    = '0';
    modal.style.transform  = 'scale(1.05)';
    setTimeout(() => {
        modal.classList.remove('visible');
        modal.style.opacity   = '';
        modal.style.transform = '';
        modal.style.transition = '';
        // Play thriller flash once
        triggerThrillerFlash();
    }, 800);
}

function launchIntroSparkles() {
    const modal = document.getElementById('mj-intro-modal');
    if (!modal) return;
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const s = document.createElement('div');
            s.style.cssText = `
                position:absolute;
                pointer-events:none;
                z-index:3;
                font-size:${Math.random() * 1.5 + 0.5}rem;
                left:${Math.random() * 100}%;
                top:${Math.random() * 100}%;
                opacity:1;
                transition: all ${Math.random() * 1.5 + 0.5}s ease-out;
            `;
            s.textContent = ['✦','⭐','★','✧','✶'][Math.floor(Math.random() * 5)];
            s.style.color = Math.random() > 0.5 ? '#FFD700' : '#C0C0C0';
            modal.appendChild(s);
            requestAnimationFrame(() => {
                s.style.transform = `translateY(-${Math.random() * 200 + 50}px) rotate(${Math.random() * 360}deg)`;
                s.style.opacity   = '0';
            });
            setTimeout(() => s.remove(), 2000);
        }, i * 80);
    }
}

/* ─────────────────────────────────────────────
   PARTICLES SYSTEM
───────────────────────────────────────────── */
function startParticles() {
    const canvas = document.getElementById('mj-particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const SYMBOLS = ['✦', '⭐', '★', '✧', '♪', '♫', '🎵'];
    const COLORS  = ['#FFD700', '#C0C0C0', '#FFF8DC', '#FFFACD', '#FFC300'];

    class Particle {
        constructor() { this.reset(true); }
        reset(fromBottom = false) {
            this.x    = Math.random() * canvas.width;
            this.y    = fromBottom ? canvas.height + 20 : Math.random() * canvas.height;
            this.vy   = -(Math.random() * 0.6 + 0.2);
            this.vx   = (Math.random() - 0.5) * 0.4;
            this.size = Math.random() * 14 + 6;
            this.sym  = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
            this.col  = COLORS[Math.floor(Math.random() * COLORS.length)];
            this.alpha = Math.random() * 0.4 + 0.1;
            this.life  = 1;
            this.decay = Math.random() * 0.002 + 0.001;
            this.rot   = Math.random() * Math.PI * 2;
            this.rotV  = (Math.random() - 0.5) * 0.02;
        }
        update() {
            this.x   += this.vx;
            this.y   += this.vy;
            this.rot += this.rotV;
            this.life -= this.decay;
            if (this.life <= 0 || this.y < -20) this.reset();
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = this.life * this.alpha;
            ctx.font        = `${this.size}px serif`;
            ctx.fillStyle   = this.col;
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rot);
            ctx.fillText(this.sym, -this.size / 2, this.size / 2);
            ctx.restore();
        }
    }

    // Init 40 particles
    _particles = Array.from({ length: 40 }, () => new Particle());

    function loop() {
        if (!_mjActive) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        _particles.forEach(p => { p.update(); p.draw(); });
        _particleLoop = requestAnimationFrame(loop);
    }
    _particleLoop = requestAnimationFrame(loop);
}

function stopParticles() {
    if (_particleLoop) cancelAnimationFrame(_particleLoop);
    _particleLoop = null;
    const canvas = document.getElementById('mj-particles-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

/* ─────────────────────────────────────────────
   THRILLER FLASH
───────────────────────────────────────────── */
function triggerThrillerFlash() {
    const ov = document.getElementById('mj-thriller-overlay');
    if (!ov) return;
    ov.classList.add('active');
    setTimeout(() => ov.classList.remove('active'), 1000);
}

/* ─────────────────────────────────────────────
   MOONWALK EASTER EGG
───────────────────────────────────────────── */
function setupMoonwalkEgg() {
    // Double-click on your avatar in the user bar → moonwalk!
    const avatar = document.getElementById('my-avatar');
    if (!avatar) return;
    avatar.addEventListener('dblclick', () => {
        if (!_mjActive) return;
        avatar.classList.add('mj-moonwalk-anim');
        showMJNotif('🕺', 'Moonwalk !', 'Smooth Criminal 🎤');
        setTimeout(() => avatar.classList.remove('mj-moonwalk-anim'), 3000);
    });
}

/* ─────────────────────────────────────────────
   MJ SYSTEM NOTIFICATION
───────────────────────────────────────────── */
function showMJNotif(icon, title, text) {
    const container = document.getElementById('notif-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'notif';
    div.style.cssText = `
        border-color: rgba(255,215,0,0.3);
        background: linear-gradient(135deg, #1a1200, #0d0f13);
        box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 0 20px rgba(255,215,0,0.1);
    `;
    div.innerHTML = `
        <div class="notif-icon">${icon}</div>
        <div class="notif-body">
            <div class="notif-title" style="color:#FFD700;font-family:'Bebas Neue',sans-serif;letter-spacing:2px">${title}</div>
            <div class="notif-text" style="color:rgba(255,215,0,0.6)">${text}</div>
        </div>
        <button class="notif-close" onclick="this.closest('.notif').remove()">✕</button>`;
    container.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}

/* ─────────────────────────────────────────────
   INJECT MJ BADGE in chat messages
───────────────────────────────────────────── */
function injectMJBadgeInMessages() {
    // Observer: add event badge to newly rendered messages
    const observer = new MutationObserver((mutations) => {
        if (!_mjActive) return;
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                // Add subtle gold shimmer to msg-time inside new messages
                node.querySelectorAll?.('.msg-time').forEach(el => {
                    if (!el.dataset.mjTagged) {
                        el.dataset.mjTagged = '1';
                        el.style.color = 'rgba(255,215,0,0.3)';
                    }
                });
            });
        });
    });
    const chatBox = document.getElementById('chat-messages');
    if (chatBox) observer.observe(chatBox, { childList: true, subtree: true });
    return observer;
}

/* ─────────────────────────────────────────────
   EVENT ACTIVATE / DEACTIVATE
───────────────────────────────────────────── */
function activateMJEvent(isFirstTime = false) {
    _mjActive = true;
    document.body.classList.add('mj-event-active');

    // Show intro only first time this session
    if (isFirstTime && !_introShown) {
        _introShown = true;
        setTimeout(() => openMJIntro(), 600);
    }

    startParticles();

    // Thriller flash every 3 minutes
    _thrillInterval = setInterval(() => {
        if (_mjActive) triggerThrillerFlash();
    }, 3 * 60 * 1000);

    // Auto-notif
    showMJNotif('🎤', 'ÉVÉNEMENT EN DIRECT', 'Michael Jackson Night sur BlabChat !');
}

function deactivateMJEvent() {
    _mjActive = false;
    document.body.classList.remove('mj-event-active');
    stopParticles();
    clearInterval(_thrillInterval);
    _thrillInterval = null;

    // Remove dynamic styles from messages
    document.querySelectorAll('.msg-time[data-mj-tagged]').forEach(el => {
        el.style.color = '';
        delete el.dataset.mjTagged;
    });
}

/* ─────────────────────────────────────────────
   KONAMI CODE EASTER EGG (↑↑↓↓←→←→BA)
───────────────────────────────────────────── */
function setupKonamiCode() {
    const SEQUENCE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let pos = 0;
    document.addEventListener('keydown', (e) => {
        if (!_mjActive) return;
        if (e.key === SEQUENCE[pos]) {
            pos++;
            if (pos === SEQUENCE.length) {
                pos = 0;
                triggerThrillerFlash();
                launchIntroSparkles();
                showMJNotif('🌙', 'THRILLER MODE', 'Hee-hee! 🕺✦');
            }
        } else {
            pos = 0;
        }
    });
}

/* ─────────────────────────────────────────────
   FIREBASE LISTENER
───────────────────────────────────────────── */
export function initMJEvent(db) {
    injectHTML();
    setupMoonwalkEgg();
    setupKonamiCode();
    injectMJBadgeInMessages();

    const eventRef = ref(db, 'events/mjackson/active');
    let firstLoad  = true;

    onValue(eventRef, (snap) => {
        const isActive = snap.val() === true;

        if (isActive && !_mjActive) {
            activateMJEvent(firstLoad);
        } else if (!isActive && _mjActive) {
            deactivateMJEvent();
        }

        firstLoad = false;
    });
}

/* ─────────────────────────────────────────────
   EXPORT UTILITIES (pour usage manuel)
───────────────────────────────────────────── */
export { triggerThrillerFlash, showMJNotif, openMJIntro };
