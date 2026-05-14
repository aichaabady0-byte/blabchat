import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getDatabase, ref, push, onChildAdded, set, onValue, serverTimestamp, off, get, update, remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ══════════════════════════════════════════════════════════════
   FIREBASE INIT
══════════════════════════════════════════════════════════════ */
const firebaseConfig = {
    apiKey: "AIzaSyBwpvOG3MyfQwqfAK4pwf-7TBKNFONIrPU",
    authDomain: "mazechat-78945.firebaseapp.com",
    databaseURL: "https://mazechat-78945-default-rtdb.firebaseio.com",
    projectId: "mazechat-78945",
    storageBucket: "mazechat-78945.firebasestorage.app",
    messagingSenderId: "816965158155",
    appId: "1:816965158155:web:54ba35107bd86f912b0e0e"
};

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

/* ══════════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════════ */
let currentView       = 'global';
let currentServerId   = 'global';
let currentChannelId  = 'general';
let currentDmUserId   = null;
let pendingJoinServer = null;
let activeListeners   = [];

// Dernier timestamp de news vu par l'utilisateur (pour le dot rouge)
let _lastSeenNewsTs   = 0;

const BP_COLORS = [
    { id: 'color-blue',   name: 'Bleu Néon',    color: '#5b6af0', price: 10 },
    { id: 'color-pink',   name: 'Rose Vif',      color: '#e05bf0', price: 10 },
    { id: 'color-green',  name: 'Vert Émeraude', color: '#3fd68f', price: 10 },
    { id: 'color-red',    name: 'Rouge Feu',     color: '#f05b5b', price: 15 },
    { id: 'color-gold',   name: 'Or',            color: '#f5c842', price: 20 },
    { id: 'color-orange', name: 'Orange',        color: '#f09d28', price: 15 },
];

const BP_FONTS = [
    { id: 'font-syne',  name: 'Syne Bold',    font: 'syne',  price: 20, preview: 'Syne' },
    { id: 'font-mono',  name: 'Monospace',     font: 'mono',  price: 15, preview: 'Mono' },
    { id: 'font-serif', name: 'Serif Élégant', font: 'serif', price: 15, preview: 'Serif' },
];

const BP_ANIMS = [
    { id: 'anim-pulse',   name: 'Pulsation',   anim: 'pulse',   price: 25, emoji: '💓' },
    { id: 'anim-rainbow', name: 'Arc-en-ciel', anim: 'rainbow', price: 35, emoji: '🌈' },
    { id: 'anim-glow',    name: 'Halo',        anim: 'glow',    price: 30, emoji: '✨' },
];

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function esc(str = '') {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function uid() { return auth.currentUser?.uid || null; }
function me()  { return auth.currentUser?.displayName || '?'; }
function dmChannelId(uid1, uid2) { return [uid1, uid2].sort().join('__'); }

function closeMobileDrawer() {
    const drawer   = document.querySelector('.mobile-drawer');
    const backdrop = document.querySelector('.mobile-drawer-backdrop');
    const btn      = document.querySelector('.mobile-menu-btn');
    if (!drawer || !backdrop || !btn) return;
    backdrop.classList.remove('open');
    drawer.classList.remove('open');
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    setTimeout(() => backdrop.classList.remove('visible'), 320);
}

/* ══════════════════════════════════════════════════════════════
   VERIFIED BADGE
══════════════════════════════════════════════════════════════ */
function verifiedBadge(isVerified = false) {
    if (!isVerified) return null;
    const img = document.createElement('img');
    img.src       = 'verified.png';
    img.alt       = 'Vérifié';
    img.title     = 'Compte vérifié';
    img.className = 'verified-badge';
    return img;
}

function verifiedBadgeHTML(isVerified = false) {
    if (!isVerified) return '';
    return `<img src="verified.png" alt="Vérifié" title="Compte vérifié" class="verified-badge">`;
}

const _verifiedCache = {};
async function isUserVerified(userId) {
    if (_verifiedCache[userId] !== undefined) return _verifiedCache[userId];
    try {
        const snap = await get(ref(db, `users/${userId}/verified`));
        _verifiedCache[userId] = snap.val() === true;
        return _verifiedCache[userId];
    } catch { return false; }
}

/* ══════════════════════════════════════════════════════════════
   BLABPLUS BADGE
══════════════════════════════════════════════════════════════ */
const _blabplusCache = {};
async function isUserBlabPlus(userId) {
    if (_blabplusCache[userId] !== undefined) return _blabplusCache[userId];
    try {
        const snap = await get(ref(db, `users/${userId}/blabplus`));
        _blabplusCache[userId] = snap.val() === true;
        return _blabplusCache[userId];
    } catch { return false; }
}

function blabplusBadgeHTML(isPlus = false) {
    if (!isPlus) return '';
    return `<span class="blabplus-badge inline">Blab+</span>`;
}

function verifiedBadgeServerHTML(isVerified = false) {
    if (!isVerified) return '';
    return `<img src="verified.png" alt="Serveur vérifié" title="Serveur vérifié" class="verified-badge">`;
}

function showNotif(icon, title, text, duration = 4000) {
    const container = document.getElementById('notif-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'notif';
    div.innerHTML = `
        <div class="notif-icon">${icon}</div>
        <div class="notif-body">
            <div class="notif-title">${esc(title)}</div>
            <div class="notif-text">${esc(text)}</div>
        </div>
        <button class="notif-close" onclick="this.closest('.notif').remove()">✕</button>`;
    container.appendChild(div);
    setTimeout(() => div.remove(), duration);
}

function stopListeners() {
    activeListeners.forEach(([path]) => off(ref(db, path)));
    activeListeners = [];
}

/* ══════════════════════════════════════════════════════════════
   MODAL SYSTEM
══════════════════════════════════════════════════════════════ */
window.closeModal = (id) => document.getElementById(id)?.classList.add('hidden');
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }

window.switchTab = (group, targetId, evt) => {
    const modal = document.getElementById(targetId)?.closest('.modal');
    if (!modal) return;
    modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    modal.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(targetId)?.classList.add('active');
    if (evt?.target) evt.target.classList.add('active');
};

/* ══════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════ */
window.showAuth = (type) => {
    openModal('modal-auth');
    const groupUser = document.getElementById('group-user');
    if (groupUser) groupUser.style.display = type === 'login' ? 'none' : 'block';
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) modalTitle.textContent = type === 'login' ? 'Connexion' : 'Créer un compte';
    const authSubmit = document.getElementById('auth-submit');
    if (authSubmit) authSubmit.onclick = () => handleAuth(type);
};

async function handleAuth(type) {
    const email = document.getElementById('auth-email')?.value.trim();
    const pass  = document.getElementById('auth-pass')?.value;
    const user  = document.getElementById('auth-user')?.value.trim();
    try {
        if (type === 'register') {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: user });
            await set(ref(db, `users/${res.user.uid}`), {
                username: user, email, status: 'online',
                createdAt: Date.now(), bp: 0, verified: false, blabplus: false
            });
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
            await update(ref(db, `users/${auth.currentUser.uid}`), { status: 'online' });
        }
        closeModal('modal-auth');
    } catch (e) { showNotif('❌', 'Erreur', e.message, 6000); }
}

window.logout = async () => {
    if (uid()) await update(ref(db, `users/${uid()}`), { status: 'offline' });
    signOut(auth);
};

/* ══════════════════════════════════════════════════════════════
   AUTH STATE
══════════════════════════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('page-discover')?.classList.remove('active');
        document.getElementById('page-app')?.classList.add('active');

        const myNameEl   = document.getElementById('my-name');
        const myAvatarEl = document.getElementById('my-avatar');
        if (myNameEl)   myNameEl.textContent   = user.displayName;
        if (myAvatarEl) myAvatarEl.textContent = user.displayName[0].toUpperCase();

        const drawerNameEl   = document.getElementById('drawer-my-name');
        const drawerAvatarEl = document.getElementById('drawer-my-avatar');
        if (drawerNameEl)   drawerNameEl.textContent   = user.displayName;
        if (drawerAvatarEl) drawerAvatarEl.textContent = user.displayName[0].toUpperCase();

        const verified = await isUserVerified(user.uid);
        const blabplus = await isUserBlabPlus(user.uid);

        if (myNameEl) {
            myNameEl.parentNode.querySelectorAll('.verified-badge, .blabplus-badge').forEach(b => b.remove());
            if (blabplus) {
                const bpBadge = document.createElement('span');
                bpBadge.className   = 'blabplus-badge inline';
                bpBadge.textContent = 'Blab+';
                myNameEl.parentNode.insertBefore(bpBadge, myNameEl.nextSibling);
            }
            if (verified) {
                const badge = verifiedBadge(true);
                myNameEl.parentNode.insertBefore(badge, myNameEl.nextSibling);
            }
        }

        initApp();
        listenFriendRequests();
        checkInviteInUrl();
        listenBP();
        loadDiscoverNews();          // Charge les news sur la page discover
        listenNewsUnreadDot();       // Active le dot rouge sidebar si nouvelles news
    } else {
        document.getElementById('page-discover')?.classList.add('active');
        document.getElementById('page-app')?.classList.remove('active');
        loadDiscoverNews();          // Visible même non connecté
    }
});

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
function initApp() {
    loadServers();
    switchView('global');
    maybeShowWhatsNewPopup();
}

/* ══════════════════════════════════════════════════════════════
   VIEW SWITCHER
══════════════════════════════════════════════════════════════ */
window.switchView = (view) => {
    currentView = view;
    stopListeners();

    document.getElementById('nav-home')?.classList.toggle('active', view === 'global');
    document.getElementById('nav-dm')?.classList.toggle('active', view === 'dm');
    document.getElementById('nav-news')?.classList.toggle('active', view === 'whats-new');

    const drawerServerName = document.getElementById('drawer-server-name');

    if (view === 'dm') {
        if (drawerServerName) drawerServerName.textContent = 'MESSAGES';
        renderDmSidebar();
        renderDmDrawer();
        showWelcomeScreen('💬', 'Messages privés', 'Sélectionne un ami pour lui écrire.');
        const csn = document.getElementById('current-server-name');
        if (csn) csn.textContent = 'MESSAGES';
        csn?.parentNode?.querySelectorAll('.verified-badge').forEach(b => b.remove());
        document.getElementById('channel-header-actions').innerHTML = '';
        document.getElementById('main-header-actions').innerHTML    = '';
        document.getElementById('members-list').innerHTML           = '';

    } else if (view === 'global') {
        currentServerId = 'global';
        if (drawerServerName) drawerServerName.textContent = 'GLOBAL';
        const csn = document.getElementById('current-server-name');
        if (csn) csn.textContent = 'GLOBAL';
        csn?.parentNode?.querySelectorAll('.verified-badge').forEach(b => b.remove());
        document.getElementById('channel-header-actions').innerHTML =
            `<button class="btn-icon" onclick="openSearchServers()" title="Rejoindre un serveur">🔍</button>`;
        document.getElementById('main-header-actions').innerHTML = '';
        renderGlobalChannels();
        renderGlobalDrawerChannels();
        renderMembersGlobal();

    } else if (view === 'whats-new') {
        // ── Vue "What's New" dans l'app ──
        if (drawerServerName) drawerServerName.textContent = "WHAT'S NEW";
        const csn = document.getElementById('current-server-name');
        if (csn) csn.textContent = "WHAT'S NEW";
        csn?.parentNode?.querySelectorAll('.verified-badge').forEach(b => b.remove());
        document.getElementById('channel-header-actions').innerHTML = '';
        document.getElementById('main-header-actions').innerHTML    = '';
        document.getElementById('members-list').innerHTML           = '';
        document.getElementById('channel-list').innerHTML           = '';
        document.getElementById('drawer-channel-list').innerHTML    = '';
        renderWhatsNewView();
        markNewsAsSeen();

    } else {
        currentServerId = view;
        loadServerView(view);
    }

    closeMobileDrawer();
};

function showWelcomeScreen(icon, title, sub) {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    box.innerHTML = `<div class="welcome-screen"><div style="font-size:3rem">${icon}</div><h2>${esc(title)}</h2><p style="color:var(--txt-3)">${esc(sub)}</p></div>`;
    const ccd = document.getElementById('current-channel-display');
    if (ccd) ccd.textContent = title;
    const cia = document.getElementById('chat-input-area');
    if (cia) cia.style.display = 'none';
}

/* ══════════════════════════════════════════════════════════════
   WHAT'S NEW — DISCOVER PAGE (visible sans connexion)
══════════════════════════════════════════════════════════════ */
function loadDiscoverNews() {
    const grid = document.getElementById('discover-news-grid');
    if (!grid) return;

    onValue(ref(db, 'news'), (snap) => {
        grid.innerHTML = '';
        if (!snap.exists()) {
            grid.innerHTML = `
                <div class="news-empty">
                    <div class="news-empty-icon">📭</div>
                    <p>Aucune annonce pour l'instant. Revenez bientôt !</p>
                </div>`;
            return;
        }

        const items = [];
        snap.forEach(child => items.push({ id: child.key, ...child.val() }));
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        items.forEach(news => {
            const card = document.createElement('div');
            card.className = 'news-card';
            const dateStr = news.createdAt
                ? new Date(news.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : '';
            card.innerHTML = `
                ${news.imageUrl
                    ? `<img class="news-card-img" src="${esc(news.imageUrl)}" alt="${esc(news.title)}">`
                    : `<div class="news-card-img-placeholder">${news.emoji || '📢'}</div>`}
                <div class="news-card-body">
                    <div class="news-card-date">${esc(dateStr)}</div>
                    ${news.author ? `<div class="news-admin-badge">⭐ ${esc(news.author)}</div>` : ''}
                    <div class="news-card-title">${esc(news.title)}</div>
                    <div class="news-card-desc">${esc(news.content)}</div>
                </div>`;
            grid.appendChild(card);
        });
    });
}

/* ══════════════════════════════════════════════════════════════
   WHAT'S NEW — POPUP AUTO (à la connexion)
══════════════════════════════════════════════════════════════ */
async function maybeShowWhatsNewPopup() {
    // Vérifie si l'utilisateur a coché "ne plus afficher"
    const dontShowSnap = await get(ref(db, `users/${uid()}/newsPopupDismissed`));
    const dismissed    = dontShowSnap.val();

    // Charge les news
    const newsSnap = await get(ref(db, 'news'));
    if (!newsSnap.exists()) return;

    const items = [];
    newsSnap.forEach(c => items.push({ id: c.key, ...c.val() }));
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!items.length) return;

    const latestTs = items[0].createdAt || 0;

    // Récupère le dernier ts vu
    const seenSnap = await get(ref(db, `users/${uid()}/newsLastSeenTs`));
    const seenTs   = seenSnap.val() || 0;

    // Affiche le popup seulement s'il y a des nouvelles news non vues
    if (dismissed && seenTs >= latestTs) return;

    renderWhatsNewPopup(items);
    document.getElementById('whats-new-popup')?.classList.remove('hidden');
}

function renderWhatsNewPopup(items) {
    const body = document.getElementById('whats-new-popup-body');
    if (!body) return;
    body.innerHTML = '';

    items.forEach(news => {
        const dateStr = news.createdAt
            ? new Date(news.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
            : '';
        const card = document.createElement('div');
        card.className = 'news-popup-card';
        card.innerHTML = `
            ${news.imageUrl
                ? `<img class="news-popup-card-img" src="${esc(news.imageUrl)}" alt="${esc(news.title)}">`
                : ''}
            <div class="news-popup-card-body">
                <div class="news-popup-card-date">
                    ${esc(dateStr)}
                    ${news.author ? `<span style="color:var(--accent);font-weight:700">· ${esc(news.author)}</span>` : ''}
                </div>
                <div class="news-popup-card-title">${esc(news.title)}</div>
                <div class="news-popup-card-desc">${esc(news.content)}</div>
            </div>`;
        body.appendChild(card);
    });
}

window.closeWhatsNewPopup = async () => {
    const overlay = document.getElementById('whats-new-popup');
    if (!overlay) return;
    overlay.classList.add('hidden');

    // Sauvegarde la préférence "ne plus afficher" si cochée
    const cb = document.getElementById('whats-new-dont-show-cb');
    if (cb?.checked && uid()) {
        await set(ref(db, `users/${uid()}/newsPopupDismissed`), true);
    }

    // Marque les news comme vues
    if (uid()) markNewsAsSeen();
};

/* ══════════════════════════════════════════════════════════════
   WHAT'S NEW — VUE IN-APP (switchView 'whats-new')
══════════════════════════════════════════════════════════════ */
function renderWhatsNewView() {
    const chatBox = document.getElementById('chat-messages');
    const cia     = document.getElementById('chat-input-area');
    if (!chatBox) return;
    if (cia) cia.style.display = 'none';

    const ccd = document.getElementById('current-channel-display');
    if (ccd) ccd.textContent = "What's New";
    const hash = document.getElementById('main-header-hash');
    if (hash) hash.textContent = '🆕';

    chatBox.innerHTML = '';

    // Conteneur de la vue
    const view = document.createElement('div');
    view.className = 'whats-new-view';
    view.style.cssText = 'display:flex;flex-direction:column;flex:1;overflow:hidden;height:100%';

    const header = document.createElement('div');
    header.className = 'whats-new-view-header';
    header.innerHTML = `
        <div class="whats-new-view-title">
            📢 Annonces &amp; nouveautés
        </div>`;

    // Bouton admin si admin (vérifié)
    isUserVerified(uid()).then(isVerified => {
        if (isVerified) {
            const adminBtn = document.createElement('button');
            adminBtn.className   = 'btn-primary';
            adminBtn.style.fontSize = '.82rem';
            adminBtn.textContent = '+ Publier une annonce';
            adminBtn.onclick     = openCreateNewsModal;
            header.appendChild(adminBtn);
        }
    });

    const cardsArea = document.createElement('div');
    cardsArea.className = 'whats-new-cards-area';

    view.appendChild(header);
    view.appendChild(cardsArea);
    chatBox.appendChild(view);

    // Charge les news en temps réel
    onValue(ref(db, 'news'), (snap) => {
        cardsArea.innerHTML = '';
        if (!snap.exists()) {
            cardsArea.innerHTML = `
                <div class="whats-new-empty">
                    <div style="font-size:2.5rem">📭</div>
                    <p>Aucune annonce pour l'instant.</p>
                </div>`;
            return;
        }
        const items = [];
        snap.forEach(c => items.push({ id: c.key, ...c.val() }));
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        items.forEach(news => {
            const dateStr = news.createdAt
                ? new Date(news.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : '';
            const card = document.createElement('div');
            card.className = 'news-full-card';
            card.innerHTML = `
                ${news.imageUrl
                    ? `<img class="news-full-card-img" src="${esc(news.imageUrl)}" alt="${esc(news.title)}">`
                    : ''}
                <div class="news-full-card-body">
                    <div class="news-full-card-meta">
                        <span class="news-full-card-date">${esc(dateStr)}</span>
                        ${news.author
                            ? `<span class="news-full-card-admin">⭐ ${esc(news.author)}</span>`
                            : ''}
                    </div>
                    <div class="news-full-card-title">${esc(news.title)}</div>
                    <div class="news-full-card-desc">${esc(news.content)}</div>
                    ${news.emoji ? `<div style="font-size:1.8rem;margin-top:10px">${esc(news.emoji)}</div>` : ''}
                </div>`;
            cardsArea.appendChild(card);
        });
    });
}

/* ══════════════════════════════════════════════════════════════
   WHAT'S NEW — DOT ROUGE SIDEBAR
══════════════════════════════════════════════════════════════ */
function listenNewsUnreadDot() {
    if (!uid()) return;

    // Écoute les news et le dernier vu en parallèle
    onValue(ref(db, 'news'), async (newsSnap) => {
        const dot = document.getElementById('news-unread-dot');
        if (!dot) return;

        if (!newsSnap.exists()) { dot.classList.remove('visible'); return; }

        // Dernier ts de news publié
        let latestTs = 0;
        newsSnap.forEach(c => {
            const ts = c.val().createdAt || 0;
            if (ts > latestTs) latestTs = ts;
        });

        // Dernier ts vu par l'utilisateur
        const seenSnap = await get(ref(db, `users/${uid()}/newsLastSeenTs`));
        const seenTs   = seenSnap.val() || 0;

        if (latestTs > seenTs) {
            dot.classList.add('visible');
        } else {
            dot.classList.remove('visible');
        }
    });
}

async function markNewsAsSeen() {
    if (!uid()) return;
    const newsSnap = await get(ref(db, 'news'));
    if (!newsSnap.exists()) return;
    let latestTs = 0;
    newsSnap.forEach(c => {
        const ts = c.val().createdAt || 0;
        if (ts > latestTs) latestTs = ts;
    });
    if (latestTs > 0) {
        await set(ref(db, `users/${uid()}/newsLastSeenTs`), latestTs);
    }
    const dot = document.getElementById('news-unread-dot');
    if (dot) dot.classList.remove('visible');

    // Si le popup "ne plus afficher" était coché pour une ancienne news,
    // on le réinitialise pour qu'il s'affiche à la prochaine
    await set(ref(db, `users/${uid()}/newsPopupDismissed`), false);
}

/* ══════════════════════════════════════════════════════════════
   WHAT'S NEW — CRÉER UNE ANNONCE (admin = compte vérifié)
══════════════════════════════════════════════════════════════ */
function openCreateNewsModal() {
    // Crée un mini-modal inline plutôt qu'un modal séparé
    const existing = document.getElementById('create-news-modal');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id          = 'create-news-modal';
    overlay.className   = 'modal-overlay';
    overlay.style.zIndex = '300';
    overlay.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal wide">
            <h2 class="modal-title">📢 Publier une annonce</h2>
            <div class="form-group">
                <label>Titre</label>
                <input type="text" id="news-title-input" placeholder="Titre de l'annonce">
            </div>
            <div class="form-group">
                <label>Contenu</label>
                <textarea id="news-content-input" placeholder="Décris la nouveauté..." style="min-height:100px"></textarea>
            </div>
            <div class="form-group">
                <label>Emoji (optionnel)</label>
                <input type="text" id="news-emoji-input" placeholder="🎉">
            </div>
            <div class="form-group">
                <label>URL Image (optionnel)</label>
                <input type="text" id="news-img-input" placeholder="https://...">
            </div>
            <button class="btn-primary btn-full" onclick="submitCreateNews()">Publier</button>
            <button class="btn-ghost btn-full" onclick="document.getElementById('create-news-modal').remove()">Annuler</button>
        </div>`;
    overlay.querySelector('.modal-backdrop').onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}

window.submitCreateNews = async () => {
    const title   = document.getElementById('news-title-input')?.value.trim();
    const content = document.getElementById('news-content-input')?.value.trim();
    const emoji   = document.getElementById('news-emoji-input')?.value.trim();
    const imgUrl  = document.getElementById('news-img-input')?.value.trim();

    if (!title || !content) {
        showNotif('⚠️', 'Champs manquants', 'Le titre et le contenu sont obligatoires.');
        return;
    }

    const newsData = {
        title,
        content,
        author:    me(),
        authorId:  uid(),
        createdAt: Date.now(),
    };
    if (emoji)  newsData.emoji    = emoji;
    if (imgUrl) newsData.imageUrl = imgUrl;

    await push(ref(db, 'news'), newsData);
    document.getElementById('create-news-modal')?.remove();
    showNotif('✅', 'Annonce publiée !', `"${title}" est maintenant visible par tous.`);
};

/* ══════════════════════════════════════════════════════════════
   GLOBAL CHANNELS
══════════════════════════════════════════════════════════════ */
const GLOBAL_CHANNELS = [
    { id: 'general',  name: 'général' },
    { id: 'random',   name: 'random' },
    { id: 'annonces', name: 'annonces' },
];

function renderGlobalChannels() {
    const list = document.getElementById('channel-list');
    if (!list) return;
    list.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'sidebar-section-label';
    label.innerHTML = '<span>SALONS</span>';
    list.appendChild(label);

    GLOBAL_CHANNELS.forEach(ch => {
        const div = document.createElement('div');
        div.className = `channel-item ${currentChannelId === ch.id ? 'active' : ''}`;
        div.innerHTML = `<span class="channel-hash">#</span> ${esc(ch.name)}`;
        div.onclick = () => {
            currentChannelId = ch.id;
            document.querySelectorAll('.channel-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            const ccd = document.getElementById('current-channel-display');
            if (ccd) ccd.textContent = ch.name;
            // Restaure le hash normal
            const hash = document.getElementById('main-header-hash');
            if (hash) hash.textContent = '#';
            loadMessages('global', ch.id);
            closeMobileDrawer();
        };
        list.appendChild(div);
    });

    currentChannelId = 'general';
    const ccd = document.getElementById('current-channel-display');
    if (ccd) ccd.textContent = 'général';
    const hash = document.getElementById('main-header-hash');
    if (hash) hash.textContent = '#';
    loadMessages('global', 'general');
    const cia = document.getElementById('chat-input-area');
    if (cia) cia.style.display = '';
}

function renderGlobalDrawerChannels() {
    const drawerList = document.getElementById('drawer-channel-list');
    if (!drawerList) return;
    drawerList.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'sidebar-section-label';
    label.innerHTML = '<span>SALONS</span>';
    drawerList.appendChild(label);

    GLOBAL_CHANNELS.forEach(ch => {
        const div = document.createElement('div');
        div.className = `channel-item ${currentChannelId === ch.id ? 'active' : ''}`;
        div.innerHTML = `<span class="channel-hash">#</span> ${esc(ch.name)}`;
        div.onclick = () => {
            currentChannelId = ch.id;
            document.querySelectorAll('.channel-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            const ccd = document.getElementById('current-channel-display');
            if (ccd) ccd.textContent = ch.name;
            loadMessages('global', ch.id);
            closeMobileDrawer();
        };
        drawerList.appendChild(div);
    });
}

/* ══════════════════════════════════════════════════════════════
   SERVER VIEW
══════════════════════════════════════════════════════════════ */
async function loadServerView(serverId) {
    const snap = await get(ref(db, `servers/${serverId}`));
    if (!snap.exists()) return;
    const serverData = snap.val();

    const serverNameEl = document.getElementById('current-server-name');
    if (serverNameEl) {
        serverNameEl.textContent = serverData.name.toUpperCase();
        serverNameEl.parentNode.querySelectorAll('.verified-badge').forEach(b => b.remove());
        if (serverData.verified === true) {
            const badge = verifiedBadge(true);
            serverNameEl.parentNode.insertBefore(badge, serverNameEl.nextSibling);
        }
    }

    const drawerServerName = document.getElementById('drawer-server-name');
    if (drawerServerName) drawerServerName.textContent = serverData.name.toUpperCase();

    const memberSnap = await get(ref(db, `servers/${serverId}/members/${uid()}`));
    if (!memberSnap.exists()) {
        showWelcomeScreen('🔒', 'Accès refusé', 'Tu n\'es pas membre de ce serveur.');
        document.getElementById('channel-list').innerHTML        = '';
        document.getElementById('drawer-channel-list').innerHTML = '';
        return;
    }

    const isOwner = serverData.owner === uid();
    document.getElementById('channel-header-actions').innerHTML =
        isOwner ? `<button class="btn-icon" onclick="openAdminPanel()" title="Administration">⚙️</button>` : '';
    document.getElementById('main-header-actions').innerHTML =
        `<button class="btn-icon" onclick="openSearchServers()" title="Rejoindre un serveur">🔍</button>`;

    // Restaure le hash normal
    const hash = document.getElementById('main-header-hash');
    if (hash) hash.textContent = '#';

    renderServerChannels(serverId);
    renderMembersServer(serverId);
}

function renderServerChannels(serverId) {
    const list       = document.getElementById('channel-list');
    const drawerList = document.getElementById('drawer-channel-list');
    if (!list) return;
    list.innerHTML = '';
    if (drawerList) drawerList.innerHTML = '';

    onValue(ref(db, `servers/${serverId}/categories`), (catSnap) => {
        const categories = {};
        catSnap.forEach(c => { categories[c.key] = c.val(); });

        onValue(ref(db, `servers/${serverId}/channels`), (chanSnap) => {
            list.innerHTML = '';
            if (drawerList) drawerList.innerHTML = '';

            const byCat = {};
            chanSnap.forEach(ch => {
                const d   = ch.val();
                const cat = d.categoryId || 'none';
                if (!byCat[cat]) byCat[cat] = [];
                byCat[cat].push({ id: ch.key, ...d });
            });

            const renderInto = (container) => {
                Object.entries(categories).forEach(([catId, catData]) => {
                    const catDiv = document.createElement('div');
                    catDiv.className = 'channel-category';
                    catDiv.innerHTML = `<span class="channel-category-name">▾ ${esc(catData.name)}</span>`;
                    container.appendChild(catDiv);
                    (byCat[catId] || []).forEach(ch => appendChannelItem(container, ch, serverId));
                });

                if (byCat['none']?.length) {
                    const noCatLabel = document.createElement('div');
                    noCatLabel.className = 'channel-category';
                    noCatLabel.innerHTML = '<span class="channel-category-name">▾ GÉNÉRAL</span>';
                    container.appendChild(noCatLabel);
                    byCat['none'].forEach(ch => appendChannelItem(container, ch, serverId));
                }
            };

            renderInto(list);
            if (drawerList) renderInto(drawerList);

            const first = list.querySelector('.channel-item');
            if (first) first.click();
        });
    });
}

function appendChannelItem(list, ch, serverId) {
    const div = document.createElement('div');
    div.className = `channel-item ${currentChannelId === ch.id ? 'active' : ''}`;
    div.innerHTML = `<span class="channel-hash">#</span> ${esc(ch.name)}`;
    div.onclick = () => {
        currentChannelId = ch.id;
        document.querySelectorAll('.channel-item').forEach(i => i.classList.remove('active'));
        div.classList.add('active');
        const ccd = document.getElementById('current-channel-display');
        if (ccd) ccd.textContent = ch.name;
        const hash = document.getElementById('main-header-hash');
        if (hash) hash.textContent = '#';
        loadMessages(serverId, ch.id);
        closeMobileDrawer();
    };
    list.appendChild(div);
}

/* ══════════════════════════════════════════════════════════════
   MESSAGES
══════════════════════════════════════════════════════════════ */
async function getUserStyle(senderId) {
    try {
        const snap = await get(ref(db, `users/${senderId}/style`));
        return snap.exists() ? snap.val() : {};
    } catch { return {}; }
}

function buildSenderEl(senderName, senderId, style = {}, verified = false, blabplus = false) {
    const color = style.color || '';
    const font  = style.font  || '';
    const anim  = style.anim  || '';
    const span  = document.createElement('span');
    span.className   = 'msg-sender';
    span.textContent = senderName;
    if (color) span.style.color = color;
    if (font)  span.dataset.font = font;
    if (anim)  span.dataset.anim = anim;

    const wrapper = document.createElement('span');
    wrapper.className = 'msg-sender-wrap';
    wrapper.appendChild(span);

    if (blabplus) {
        const badge = document.createElement('span');
        badge.className   = 'blabplus-badge inline';
        badge.textContent = 'Blab+';
        wrapper.appendChild(badge);
    }

    if (verified) {
        const badge = verifiedBadge(true);
        wrapper.appendChild(badge);
    }

    return wrapper;
}

function loadMessages(serverId, channelId) {
    stopListeners();
    const chatBox = document.getElementById('chat-messages');
    if (!chatBox) return;
    chatBox.innerHTML = '';
    const cia = document.getElementById('chat-input-area');
    if (cia) cia.style.display = '';

    const msgPath  = `messages/${serverId}/${channelId}`;
    let lastDate   = null;
    let lastSender = null;

    const listener = onChildAdded(ref(db, msgPath), async (snap) => {
        const m = snap.val();
        if (!m) return;

        const msgDate = m.timestamp
            ? new Date(m.timestamp).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })
            : null;
        if (msgDate && msgDate !== lastDate) {
            const div = document.createElement('div');
            div.className = 'date-divider';
            div.innerHTML = `<span>${msgDate}</span>`;
            chatBox.appendChild(div);
            lastDate = msgDate;
        }

        const isOwn      = m.senderId === uid();
        const showAvatar = m.sender !== lastSender;
        lastSender = m.sender;
        const time = m.timestamp
            ? new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })
            : '';

        const style    = m.senderId ? await getUserStyle(m.senderId)    : {};
        const verified = m.senderId ? await isUserVerified(m.senderId)  : false;
        const blabplus = m.senderId ? await isUserBlabPlus(m.senderId)  : false;

        const msgDiv = document.createElement('div');
        msgDiv.className = `msg-line ${isOwn ? 'own-msg' : ''}`;

        const avatarCol = document.createElement('div');
        avatarCol.className = 'msg-avatar-col';

        if (showAvatar) {
            const av = document.createElement('div');
            av.className   = 'msg-avatar';
            av.textContent = (m.sender || '?')[0].toUpperCase();
            if (style.color) av.style.background = style.color;

            if (verified) {
                const avWrap = document.createElement('div');
                avWrap.style.position = 'relative';
                avWrap.style.display  = 'inline-block';
                avWrap.appendChild(av);
                const miniVerified     = document.createElement('img');
                miniVerified.src       = 'verified.png';
                miniVerified.className = 'verified-badge-avatar';
                miniVerified.alt       = 'Vérifié';
                miniVerified.title     = 'Compte vérifié';
                avWrap.appendChild(miniVerified);
                avatarCol.appendChild(avWrap);
            } else {
                avatarCol.appendChild(av);
            }
        }

        const contentCol = document.createElement('div');
        contentCol.className = 'msg-content-col';

        if (showAvatar) {
            const header   = document.createElement('div');
            header.className = 'msg-header';
            const senderEl = buildSenderEl(m.sender || '?', m.senderId, style, verified, blabplus);
            const timeEl   = document.createElement('span');
            timeEl.className   = 'msg-time';
            timeEl.textContent = time;
            header.appendChild(senderEl);
            header.appendChild(timeEl);
            contentCol.appendChild(header);
        }

        const textEl = document.createElement('div');
        textEl.className = 'msg-text';
        textEl.innerHTML = formatMessage(m.text);
        contentCol.appendChild(textEl);

        if (isOwn) {
            const actions = document.createElement('div');
            actions.className = 'msg-actions';
            actions.innerHTML = `<button class="msg-action-btn" onclick="deleteMsg('${msgPath}','${snap.key}')">🗑</button>`;
            msgDiv.appendChild(actions);
        }

        msgDiv.appendChild(avatarCol);
        msgDiv.appendChild(contentCol);
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    activeListeners.push([msgPath, listener]);
}

window.deleteMsg = async (path, key) => {
    if (!confirm('Supprimer ce message ?')) return;
    await remove(ref(db, `${path}/${key}`));
};

function formatMessage(text) {
    if (!text) return '';
    return esc(text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

const sendBtn  = document.getElementById('sendBtn');
const msgInput = document.getElementById('msgInput');
if (sendBtn)  sendBtn.onclick = sendMessage;
if (msgInput) msgInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const input = document.getElementById('msgInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !auth.currentUser) return;

    if (currentDmUserId && currentView === 'dm') {
        const dmId = dmChannelId(uid(), currentDmUserId);
        push(ref(db, `messages/dm/${dmId}`), {
            sender: me(), senderId: uid(), text, timestamp: serverTimestamp()
        });
    } else {
        push(ref(db, `messages/${currentServerId}/${currentChannelId}`), {
            sender: me(), senderId: uid(), text, timestamp: serverTimestamp()
        });
    }
    input.value = '';
    awardBPForActivity();
}

/* ══════════════════════════════════════════════════════════════
   SERVERS
══════════════════════════════════════════════════════════════ */
function loadServers() {
    onValue(ref(db, 'servers'), (snap) => {
        const list  = document.getElementById('server-list');
        const dlist = document.getElementById('drawer-server-list');
        if (list)  list.innerHTML  = '';
        if (dlist) dlist.innerHTML = '';

        snap.forEach(child => {
            const s        = child.val();
            const isMember = s.members && s.members[uid()];
            if (!isMember) return;

            const targets = [];
            if (list)  targets.push(list);
            if (dlist) targets.push(dlist);

            targets.forEach(container => {
                const wrap = document.createElement('div');
                wrap.style.position = 'relative';
                wrap.style.display  = 'inline-block';

                const div = document.createElement('div');
                div.className = `server-icon ${currentServerId === child.key ? 'active' : ''}`;
                div.innerText = s.icon || s.name[0].toUpperCase();
                div.title     = s.name + (s.verified ? ' ✓ Vérifié' : '');
                div.onclick   = () => switchView(child.key);
                wrap.appendChild(div);

                if (s.verified === true) {
                    const badge       = document.createElement('img');
                    badge.src         = 'verified.png';
                    badge.className   = 'verified-badge-server-icon';
                    badge.alt         = 'Serveur vérifié';
                    badge.title       = 'Serveur vérifié';
                    wrap.appendChild(badge);
                }
                container.appendChild(wrap);
            });
        });
    });
}

window.createNewServer = async () => {
    const name = prompt('Nom du serveur ?');
    if (!name?.trim()) return;
    const newRef = push(ref(db, 'servers'));
    await set(newRef, {
        name: name.trim(),
        icon: name.trim()[0].toUpperCase(),
        owner: uid(),
        createdAt: Date.now(),
        members: { [uid()]: { role: 'owner', joinedAt: Date.now() } },
        inviteCode: generateInviteCode(),
        verified: false
    });
    await push(ref(db, `servers/${newRef.key}/channels`), { name: 'général', categoryId: null });
    switchView(newRef.key);
};

function generateInviteCode(len = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/* ══════════════════════════════════════════════════════════════
   JOIN SERVER
══════════════════════════════════════════════════════════════ */
window.openSearchServers = () => {
    openModal('modal-search-servers');
    const results = document.getElementById('server-search-results');
    if (results) results.innerHTML = '<div class="empty-state">Tape pour chercher...</div>';
    const input = document.getElementById('server-search-input');
    if (input) input.value = '';
};

window.searchServers = async (query) => {
    const results = document.getElementById('server-search-results');
    if (!results) return;
    if (!query.trim()) { results.innerHTML = '<div class="empty-state">Tape pour chercher...</div>'; return; }
    results.innerHTML = '<div class="empty-state">Recherche...</div>';

    const snap  = await get(ref(db, 'servers'));
    const found = [];
    snap.forEach(child => {
        const s = child.val();
        if (s.name.toLowerCase().includes(query.toLowerCase())) found.push({ id: child.key, ...s });
    });

    if (!found.length) { results.innerHTML = '<div class="empty-state">Aucun serveur trouvé.</div>'; return; }
    results.innerHTML = '';
    found.forEach(s => {
        const isMember = s.members && s.members[uid()];
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="friend-card-avatar" style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700">${esc(s.icon || s.name[0])}</div>
            <div style="flex:1">
                <div style="font-weight:600;font-size:.9rem;display:flex;align-items:center;gap:4px">
                    ${esc(s.name)}${verifiedBadgeHTML(s.verified)}
                </div>
                <div style="font-size:.75rem;color:var(--txt-3)">${Object.keys(s.members||{}).length} membre(s)</div>
            </div>
            ${isMember
                ? `<button class="btn-ghost" style="font-size:.8rem" onclick="switchView('${s.id}');closeModal('modal-search-servers')">Accéder</button>`
                : `<button class="btn-primary" style="font-size:.8rem" onclick="promptJoinServer('${s.id}')">Rejoindre</button>`}`;
        results.appendChild(div);
    });
};

window.promptJoinServer = async (serverId) => {
    const snap = await get(ref(db, `servers/${serverId}`));
    if (!snap.exists()) return;
    pendingJoinServer = { id: serverId, data: snap.val() };
    const icon = document.getElementById('join-confirm-icon');
    const name = document.getElementById('join-confirm-name');
    const desc = document.getElementById('join-confirm-desc');
    if (icon) icon.textContent = snap.val().icon || snap.val().name[0];
    if (name) name.innerHTML   = esc(snap.val().name) + verifiedBadgeHTML(snap.val().verified);
    if (desc) desc.textContent = `Voulez-vous rejoindre le serveur "${snap.val().name}" ?`;
    closeModal('modal-search-servers');
    openModal('modal-join-confirm');
};

window.confirmJoinServer = async () => {
    if (!pendingJoinServer) return;
    const { id } = pendingJoinServer;
    await update(ref(db, `servers/${id}/members/${uid()}`), { role: 'member', joinedAt: Date.now() });
    closeModal('modal-join-confirm');
    pendingJoinServer = null;
    loadServers();
    switchView(id);
    showNotif('✅', 'Serveur rejoint !', 'Bienvenue sur le serveur.');
};

window.joinByInviteLink = async () => {
    const raw  = document.getElementById('invite-link-input')?.value.trim();
    if (!raw) return;
    const code = raw.includes('/') ? raw.split('/').pop() : raw;

    const snap = await get(ref(db, 'servers'));
    let found  = null;
    snap.forEach(child => {
        const s = child.val();
        if (s.inviteCode === code.toUpperCase()) found = { id: child.key, data: s };
    });

    if (!found) { showNotif('❌', 'Lien invalide', 'Aucun serveur trouvé avec ce code.'); return; }
    pendingJoinServer = found;
    const icon = document.getElementById('join-confirm-icon');
    const name = document.getElementById('join-confirm-name');
    const desc = document.getElementById('join-confirm-desc');
    if (icon) icon.textContent = found.data.icon || found.data.name[0];
    if (name) name.innerHTML   = esc(found.data.name) + verifiedBadgeHTML(found.data.verified);
    if (desc) desc.textContent = `Voulez-vous rejoindre le serveur "${found.data.name}" ?`;
    closeModal('modal-search-servers');
    openModal('modal-join-confirm');
};

function checkInviteInUrl() {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('invite');
    if (code) {
        const input = document.getElementById('invite-link-input');
        if (input) input.value = code;
        openModal('modal-search-servers');
        const tabSearch = document.getElementById('tab-search-sv');
        const tabInvite = document.getElementById('tab-invite');
        if (tabSearch) tabSearch.classList.remove('active');
        if (tabInvite) tabInvite.classList.add('active');
    }
}

/* ══════════════════════════════════════════════════════════════
   ADMIN PANEL
══════════════════════════════════════════════════════════════ */
window.openAdminPanel = async () => {
    openModal('modal-admin');
    loadAdminCategories();
    loadAdminRoles();
    loadAdminMembers();
    generateInviteLink();
};

async function loadAdminCategories() {
    const snap   = await get(ref(db, `servers/${currentServerId}/categories`));
    const list   = document.getElementById('admin-category-list');
    const select = document.getElementById('admin-channel-category');
    if (!list || !select) return;
    list.innerHTML   = '';
    select.innerHTML = '<option value="">Sans catégorie</option>';

    snap.forEach(child => {
        const c = child.val();
        const div = document.createElement('div');
        div.className = 'role-item';
        div.innerHTML = `
            <span class="role-name">${esc(c.name)}</span>
            <button class="btn-danger" style="padding:4px 10px;font-size:.75rem" onclick="deleteCategory('${child.key}')">✕</button>`;
        list.appendChild(div);
        const opt = document.createElement('option');
        opt.value       = child.key;
        opt.textContent = c.name;
        select.appendChild(opt);
    });
}

window.createCategory = async () => {
    const name = prompt('Nom de la catégorie ?');
    if (!name?.trim()) return;
    await push(ref(db, `servers/${currentServerId}/categories`), { name: name.trim() });
    loadAdminCategories();
};

window.deleteCategory = async (catId) => {
    await remove(ref(db, `servers/${currentServerId}/categories/${catId}`));
    loadAdminCategories();
};

window.adminCreateChannel = async () => {
    const nameEl     = document.getElementById('admin-channel-name');
    const categoryEl = document.getElementById('admin-channel-category');
    const name       = nameEl?.value.trim();
    const categoryId = categoryEl?.value || null;
    if (!name) return;
    await push(ref(db, `servers/${currentServerId}/channels`), {
        name: name.toLowerCase().replace(/\s+/g, '-'), categoryId
    });
    if (nameEl) nameEl.value = '';
    showNotif('✅', 'Salon créé', `#${name} a été créé.`);
};

async function loadAdminRoles() {
    const snap = await get(ref(db, `servers/${currentServerId}/roles`));
    const list = document.getElementById('admin-role-list');
    if (!list) return;
    list.innerHTML = '';
    if (!snap.exists()) { list.innerHTML = '<div class="empty-state">Aucun rôle créé.</div>'; return; }
    snap.forEach(child => {
        const r   = child.val();
        const div = document.createElement('div');
        div.className = 'role-item';
        div.innerHTML = `
            <div class="role-color" style="background:${esc(r.color || '#888')}"></div>
            <span class="role-name">${esc(r.name)}</span>
            <div style="display:flex;gap:4px;margin-left:auto">
                <button class="btn-danger" style="padding:4px 10px;font-size:.75rem" onclick="deleteRole('${child.key}')">✕</button>
            </div>`;
        list.appendChild(div);
    });
}

window.adminCreateRole = async () => {
    const nameEl  = document.getElementById('new-role-name');
    const colorEl = document.getElementById('new-role-color');
    const name    = nameEl?.value.trim();
    const color   = colorEl?.value || '#5b6af0';
    if (!name) return;
    const permissions = {
        manageChannels: document.getElementById('perm-manage-channels')?.checked ?? false,
        manageMembers:  document.getElementById('perm-manage-members')?.checked  ?? false,
        deleteMessages: document.getElementById('perm-delete-messages')?.checked ?? false,
        sendMessages:   document.getElementById('perm-send-messages')?.checked   ?? true,
    };
    await push(ref(db, `servers/${currentServerId}/roles`), { name, color, permissions });
    if (nameEl) nameEl.value = '';
    showNotif('✅', 'Rôle créé', `Le rôle "${name}" a été créé.`);
    loadAdminRoles();
};

window.deleteRole = async (roleId) => {
    await remove(ref(db, `servers/${currentServerId}/roles/${roleId}`));
    loadAdminRoles();
};

async function loadAdminMembers() {
    const snap      = await get(ref(db, `servers/${currentServerId}/members`));
    const rolesSnap = await get(ref(db, `servers/${currentServerId}/roles`));
    const list      = document.getElementById('admin-members-list');
    if (!list) return;
    list.innerHTML = '';

    const roles = {};
    rolesSnap.forEach(r => { roles[r.key] = r.val(); });

    const userIds = [];
    snap.forEach(m => userIds.push({ uid: m.key, ...m.val() }));

    for (const member of userIds) {
        const userSnap = await get(ref(db, `users/${member.uid}`));
        if (!userSnap.exists()) continue;
        const u   = userSnap.val();
        const div = document.createElement('div');
        div.className = 'friend-card';
        div.innerHTML = `
            <div class="friend-card-avatar">${esc(u.username[0])}</div>
            <div class="friend-card-info">
                <div class="friend-card-name" style="display:flex;align-items:center;gap:4px">
                    ${esc(u.username)}${verifiedBadgeHTML(u.verified)}${blabplusBadgeHTML(u.blabplus)}
                </div>
                <div class="friend-card-status">${esc(member.role || 'member')}</div>
            </div>
            ${member.uid !== uid() ? `
            <div class="friend-card-actions">
                <select onchange="assignRole('${member.uid}', this.value)" style="background:var(--bg-high);border:1px solid var(--border);color:var(--txt-1);border-radius:6px;padding:4px;font-family:inherit;font-size:.8rem">
                    <option value="">Rôle...</option>
                    ${Object.entries(roles).map(([id, r]) => `<option value="${id}">${esc(r.name)}</option>`).join('')}
                </select>
                <button class="btn-danger" style="padding:4px 8px;font-size:.75rem" onclick="kickMember('${member.uid}')">Kick</button>
            </div>` : '<span style="font-size:.75rem;color:var(--accent)">Propriétaire</span>'}`;
        list.appendChild(div);
    }
}

window.assignRole = async (memberId, roleId) => {
    if (!roleId) return;
    await update(ref(db, `servers/${currentServerId}/members/${memberId}`), { roleId });
    showNotif('✅', 'Rôle assigné', 'Le rôle a été attribué.');
};

window.kickMember = async (memberId) => {
    if (!confirm('Expulser ce membre ?')) return;
    await remove(ref(db, `servers/${currentServerId}/members/${memberId}`));
    loadAdminMembers();
    showNotif('🚪', 'Membre expulsé', 'Le membre a été retiré du serveur.');
};

/* ══════════════════════════════════════════════════════════════
   INVITE LINKS
══════════════════════════════════════════════════════════════ */
async function generateInviteLink() {
    const snap = await get(ref(db, `servers/${currentServerId}/inviteCode`));
    let code   = snap.val();
    if (!code) {
        code = generateInviteCode();
        await set(ref(db, `servers/${currentServerId}/inviteCode`), code);
    }
    const link = `${window.location.origin}${window.location.pathname}?invite=${code}`;
    const el   = document.getElementById('invite-link-display');
    if (el) el.textContent = link;
    return link;
}

window.copyInviteLink = async () => {
    const link = await generateInviteLink();
    await navigator.clipboard.writeText(link).catch(() => {});
    showNotif('📋', 'Lien copié !', 'Le lien d\'invitation est dans ton presse-papiers.');
};

window.regenerateInvite = async () => {
    const code = generateInviteCode();
    await set(ref(db, `servers/${currentServerId}/inviteCode`), code);
    generateInviteLink();
    showNotif('🔄', 'Nouveau lien', 'L\'ancien lien ne fonctionne plus.');
};

/* ══════════════════════════════════════════════════════════════
   MEMBERS SIDEBAR
══════════════════════════════════════════════════════════════ */
function renderMembersGlobal() {
    onValue(ref(db, 'users'), (snap) => {
        const list = document.getElementById('members-list');
        if (!list) return;
        list.innerHTML = '';
        snap.forEach(child => {
            const u   = child.val();
            const div = document.createElement('div');
            div.className = 'member-item';
            div.innerHTML = `
                <div class="member-avatar">${esc(u.username[0])}
                    <div class="member-status ${u.status === 'online' ? '' : 'offline'}"></div>
                </div>
                <span class="member-name">${esc(u.username)}</span>
                ${verifiedBadgeHTML(u.verified)}${blabplusBadgeHTML(u.blabplus)}`;
            div.onclick = () => { if (child.key !== uid()) openDmWith(child.key, u.username); };
            list.appendChild(div);
        });
    });
}

async function renderMembersServer(serverId) {
    const snap      = await get(ref(db, `servers/${serverId}/members`));
    const rolesSnap = await get(ref(db, `servers/${serverId}/roles`));
    const list      = document.getElementById('members-list');
    if (!list) return;
    list.innerHTML = '';

    const roles = {};
    rolesSnap.forEach(r => { roles[r.key] = r.val(); });

    const promises = [];
    snap.forEach(m => {
        promises.push(get(ref(db, `users/${m.key}`)).then(u => ({ uid: m.key, member: m.val(), user: u.val() })));
    });

    const all = await Promise.all(promises);
    all.forEach(({ uid: memberId, member, user }) => {
        if (!user) return;
        const div  = document.createElement('div');
        div.className = 'member-item';
        const role = member.roleId && roles[member.roleId];
        div.innerHTML = `
            <div class="member-avatar">${esc(user.username[0])}
                <div class="member-status ${user.status === 'online' ? '' : 'offline'}"></div>
            </div>
            <span class="member-name">${esc(user.username)}</span>
            ${verifiedBadgeHTML(user.verified)}${blabplusBadgeHTML(user.blabplus)}
            ${role ? `<span class="member-role-badge" style="background:${esc(role.color)}22;color:${esc(role.color)}">${esc(role.name)}</span>` : ''}`;
        div.onclick = () => { if (memberId !== uid()) openDmWith(memberId, user.username); };
        list.appendChild(div);
    });
}

/* ══════════════════════════════════════════════════════════════
   DIRECT MESSAGES
══════════════════════════════════════════════════════════════ */
function renderDmSidebar() {
    const list = document.getElementById('channel-list');
    if (!list) return;
    list.innerHTML = '<div class="sidebar-section-label"><span>MESSAGES PRIVÉS</span></div>';
    const membersList = document.getElementById('members-list');
    if (membersList) membersList.innerHTML = '';
    _renderDmFriends(list);
}

function renderDmDrawer() {
    const drawerList = document.getElementById('drawer-channel-list');
    if (!drawerList) return;
    drawerList.innerHTML = '<div class="sidebar-section-label"><span>MESSAGES PRIVÉS</span></div>';
    _renderDmFriends(drawerList);
}

function _renderDmFriends(container) {
    onValue(ref(db, `users/${uid()}/friends`), async (snap) => {
        container.querySelectorAll('.dm-item, .empty-state').forEach(el => el.remove());

        const promises = [];
        snap.forEach(child => {
            if (child.val() === 'accepted') {
                promises.push(get(ref(db, `users/${child.key}`)).then(u => ({ uid: child.key, user: u.val() })));
            }
        });
        const friends = await Promise.all(promises);
        friends.forEach(({ uid: fid, user }) => {
            if (!user) return;
            const div = document.createElement('div');
            div.className = `dm-item ${currentDmUserId === fid ? 'active' : ''}`;
            div.innerHTML = `
                <div class="dm-avatar">${esc(user.username[0])}</div>
                <span class="dm-name">${esc(user.username)}</span>
                ${verifiedBadgeHTML(user.verified)}${blabplusBadgeHTML(user.blabplus)}`;
            div.onclick = () => openDmWith(fid, user.username);
            container.appendChild(div);
        });
        if (!friends.length) {
            const empty = document.createElement('div');
            empty.className     = 'empty-state';
            empty.style.padding = '20px 12px';
            empty.textContent   = 'Aucun ami encore. Ajoutes-en !';
            container.appendChild(empty);
        }
    });
}

function openDmWith(userId, username) {
    currentDmUserId = userId;
    currentView     = 'dm';

    document.getElementById('nav-dm')?.classList.add('active');
    const ccd = document.getElementById('current-channel-display');
    if (ccd) ccd.textContent = username;
    const cia = document.getElementById('chat-input-area');
    if (cia) cia.style.display = '';
    document.getElementById('main-header-actions').innerHTML =
        `<span style="font-size:.8rem;color:var(--txt-3)">💬 Message privé</span>`;
    const hash = document.getElementById('main-header-hash');
    if (hash) hash.textContent = '💬';

    document.querySelectorAll('.dm-item').forEach(el => el.classList.remove('active'));

    const dmId = dmChannelId(uid(), userId);
    loadMessages('dm', dmId);
    closeMobileDrawer();
}

/* ══════════════════════════════════════════════════════════════
   FRIENDS
══════════════════════════════════════════════════════════════ */
window.openFriendsModal = () => {
    openModal('modal-friends');
    loadMyFriends();
    loadFriendRequests();
};

async function loadMyFriends() {
    const snap      = await get(ref(db, `users/${uid()}/friends`));
    const container = document.getElementById('tab-myfriends');
    if (!container) return;
    container.innerHTML = '';

    if (!snap.exists()) { container.innerHTML = '<div class="empty-state">Aucun ami pour l\'instant.</div>'; return; }

    const promises = [];
    snap.forEach(child => {
        if (child.val() === 'accepted')
            promises.push(get(ref(db, `users/${child.key}`)).then(u => ({ uid: child.key, user: u.val() })));
    });

    const friends = await Promise.all(promises);
    if (!friends.length) { container.innerHTML = '<div class="empty-state">Aucun ami pour l\'instant.</div>'; return; }

    friends.forEach(({ uid: fid, user }) => {
        if (!user) return;
        const div = document.createElement('div');
        div.className = 'friend-card';
        div.innerHTML = `
            <div class="friend-card-avatar">${esc(user.username[0])}</div>
            <div class="friend-card-info">
                <div class="friend-card-name" style="display:flex;align-items:center;gap:4px">
                    ${esc(user.username)}${verifiedBadgeHTML(user.verified)}${blabplusBadgeHTML(user.blabplus)}
                </div>
                <div class="friend-card-status">${user.status === 'online' ? '🟢 En ligne' : '⚫ Hors ligne'}</div>
            </div>
            <div class="friend-card-actions">
                <button class="btn-primary" style="font-size:.8rem;padding:6px 10px" onclick="openDmWith('${fid}','${esc(user.username)}');closeModal('modal-friends')">💬</button>
                <button class="btn-danger" style="padding:6px 10px;font-size:.8rem" onclick="removeFriend('${fid}')">✕</button>
            </div>`;
        container.appendChild(div);
    });
}

async function loadFriendRequests() {
    const container = document.getElementById('tab-requests');
    if (!container) return;
    container.innerHTML = '';

    const snap = await get(ref(db, `users/${uid()}/friendRequests`));
    if (!snap.exists()) { container.innerHTML = '<div class="empty-state">Aucune demande en attente.</div>'; return; }

    const promises = [];
    snap.forEach(child => {
        if (child.val() === 'pending')
            promises.push(get(ref(db, `users/${child.key}`)).then(u => ({ uid: child.key, user: u.val() })));
    });

    const reqs = await Promise.all(promises);
    if (!reqs.length) { container.innerHTML = '<div class="empty-state">Aucune demande en attente.</div>'; return; }

    reqs.forEach(({ uid: rid, user }) => {
        if (!user) return;
        const div = document.createElement('div');
        div.className = 'friend-card';
        div.innerHTML = `
            <div class="friend-card-avatar">${esc(user.username[0])}</div>
            <div class="friend-card-info">
                <div class="friend-card-name" style="display:flex;align-items:center;gap:4px">
                    ${esc(user.username)}${verifiedBadgeHTML(user.verified)}
                </div>
                <div class="friend-card-status">Demande reçue</div>
            </div>
            <div class="friend-card-actions">
                <button class="btn-green" onclick="acceptFriendRequest('${rid}','${esc(user.username)}')">✓</button>
                <button class="btn-danger" onclick="declineFriendRequest('${rid}')">✕</button>
            </div>`;
        container.appendChild(div);
    });
}

window.searchUsers = async (query) => {
    const results = document.getElementById('friend-search-results');
    if (!results) return;
    if (!query.trim()) { results.innerHTML = '<div class="empty-state">Tape pour chercher...</div>'; return; }

    const snap = await get(ref(db, 'users'));
    results.innerHTML = '';
    let count = 0;
    snap.forEach(child => {
        if (child.key === uid()) return;
        const u = child.val();
        if (!u.username?.toLowerCase().includes(query.toLowerCase()) &&
            !u.email?.toLowerCase().includes(query.toLowerCase())) return;
        count++;
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="friend-card-avatar" style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700">${esc(u.username[0])}</div>
            <div style="flex:1">
                <div style="font-weight:600;font-size:.9rem;display:flex;align-items:center;gap:4px">
                    ${esc(u.username)}${verifiedBadgeHTML(u.verified)}${blabplusBadgeHTML(u.blabplus)}
                </div>
                <div style="font-size:.75rem;color:var(--txt-3)">${esc(u.email || '')}</div>
            </div>
            <button class="btn-primary" style="font-size:.8rem;padding:6px 12px" onclick="sendFriendRequest('${child.key}','${esc(u.username)}')">+ Ami</button>`;
        results.appendChild(div);
    });
    if (!count) results.innerHTML = '<div class="empty-state">Aucun utilisateur trouvé.</div>';
};

window.sendFriendRequest = async (targetId, targetName) => {
    await set(ref(db, `users/${targetId}/friendRequests/${uid()}`), 'pending');
    showNotif('📨', 'Demande envoyée', `Demande d'amitié envoyée à ${targetName}.`);
};

window.acceptFriendRequest = async (requesterId, requesterName) => {
    await set(ref(db, `users/${uid()}/friends/${requesterId}`), 'accepted');
    await set(ref(db, `users/${requesterId}/friends/${uid()}`), 'accepted');
    await remove(ref(db, `users/${uid()}/friendRequests/${requesterId}`));
    showNotif('🎉', 'Ami ajouté !', `${requesterName} est maintenant ton ami.`);
    loadMyFriends();
    loadFriendRequests();
};

window.declineFriendRequest = async (requesterId) => {
    await remove(ref(db, `users/${uid()}/friendRequests/${requesterId}`));
    loadFriendRequests();
};

window.removeFriend = async (friendId) => {
    if (!confirm('Retirer cet ami ?')) return;
    await remove(ref(db, `users/${uid()}/friends/${friendId}`));
    await remove(ref(db, `users/${friendId}/friends/${uid()}`));
    loadMyFriends();
    showNotif('👋', 'Ami retiré', 'Cette personne n\'est plus dans ta liste d\'amis.');
};

function listenFriendRequests() {
    onChildAdded(ref(db, `users/${uid()}/friendRequests`), async (snap) => {
        if (snap.val() !== 'pending') return;
        const userSnap = await get(ref(db, `users/${snap.key}`));
        if (!userSnap.exists()) return;
        showNotif('👥', 'Demande d\'ami', `${userSnap.val().username} veut être ton ami !`);
    });
}

/* ══════════════════════════════════════════════════════════════
   BLABPOINTS — BALANCE
══════════════════════════════════════════════════════════════ */
let _currentBP = 0;

function listenBP() {
    onValue(ref(db, `users/${uid()}/bp`), (snap) => {
        _currentBP = snap.val() || 0;
        const bpCount = document.getElementById('user-bp-count');
        if (bpCount) bpCount.textContent = `⭐ ${_currentBP}`;
        const bal = document.getElementById('bp-modal-balance');
        if (bal) bal.innerHTML = `${_currentBP} <span>BP</span>`;
    });
}

async function addBP(amount) {
    const newVal = _currentBP + amount;
    await set(ref(db, `users/${uid()}/bp`), newVal);
}

async function spendBP(amount) {
    if (_currentBP < amount) return false;
    await set(ref(db, `users/${uid()}/bp`), _currentBP - amount);
    return true;
}

let _msgsSinceLastBP = 0;
async function awardBPForActivity() {
    _msgsSinceLastBP++;
    if (_msgsSinceLastBP >= 10) {
        _msgsSinceLastBP = 0;
        await addBP(1);
        showNotif('⭐', '+1 BlabPoint', 'Tu es actif(ve) ! Continue comme ça.');
    }
}

/* ══════════════════════════════════════════════════════════════
   BLABPOINTS — DAILY REWARD
══════════════════════════════════════════════════════════════ */
window.claimDailyBP = async () => {
    const today    = new Date().toISOString().slice(0, 10);
    const lastSnap = await get(ref(db, `users/${uid()}/lastDailyClaim`));
    const last     = lastSnap.val();

    if (last === today) {
        showNotif('⏳', 'Déjà réclamé', 'Reviens demain pour ta récompense quotidienne.');
        return;
    }

    await addBP(5);
    await set(ref(db, `users/${uid()}/lastDailyClaim`), today);
    showNotif('🎁', '+5 BlabPoints !', 'Récompense quotidienne réclamée. À demain !');
    refreshDailyUI(today);
};

async function refreshDailyUI(todayOverride) {
    const today    = todayOverride || new Date().toISOString().slice(0, 10);
    const lastSnap = await get(ref(db, `users/${uid()}/lastDailyClaim`));
    const last     = lastSnap.val();
    const claimed  = last === today;

    const btn   = document.getElementById('daily-claim-btn');
    const label = document.getElementById('daily-reward-label');
    const sub   = document.getElementById('daily-reward-sub');
    if (!btn) return;

    if (claimed) {
        btn.disabled = true;
        if (label) label.textContent = 'Récompense déjà réclamée aujourd\'hui';
        if (sub)   sub.textContent   = 'Reviens demain pour +5 BP.';
    } else {
        btn.disabled = false;
        if (label) label.textContent = 'Récompense quotidienne disponible !';
        if (sub)   sub.textContent   = 'Tu peux récupérer tes 5 BlabPoints aujourd\'hui.';
    }
}

/* ══════════════════════════════════════════════════════════════
   BLABPOINTS — SHOP
══════════════════════════════════════════════════════════════ */
window.openBPShop = async () => {
    openModal('modal-bp-shop');

    const balEl = document.getElementById('bp-modal-balance');
    if (balEl) balEl.innerHTML = `${_currentBP} <span>BP</span>`;

    const previewName = me();
    ['profile-preview-name','profile-preview-name-font','profile-preview-name-anim'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = previewName;
    });

    const styleSnap = await get(ref(db, `users/${uid()}/style`));
    const style     = styleSnap.exists() ? styleSnap.val() : {};
    const ownedSnap = await get(ref(db, `users/${uid()}/owned`));
    const owned     = ownedSnap.exists() ? ownedSnap.val() : {};

    const plusSnap  = await get(ref(db, `users/${uid()}/blabplus`));
    const isPlus    = plusSnap.val() === true;

    applyStyleToPreview('profile-preview-name',      style);
    applyStyleToPreview('profile-preview-name-font', style);
    applyStyleToPreview('profile-preview-name-anim', style);

    renderColorShop(owned, style, isPlus);
    renderFontShop(owned, style, isPlus);
    renderAnimShop(owned, style, isPlus);
    refreshDailyUI();
};

function applyStyleToPreview(elId, style) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.style.color  = style.color || '';
    el.dataset.font = style.font  || '';
    el.dataset.anim = style.anim  || '';
}

function discountedPrice(price, isPlus) {
    return isPlus ? Math.floor(price * 0.8) : price;
}

function priceHTML(item, isPlus) {
    if (!isPlus) return `⭐ ${item.price} BP`;
    const discounted = discountedPrice(item.price, true);
    return `⭐ ${discounted} BP <span class="bplus-discount" style="text-decoration:line-through;color:#555;font-size:.7rem;margin-left:2px">${item.price}</span>`;
}

function renderColorShop(owned, style, isPlus = false) {
    const grid = document.getElementById('shop-cosmetics-grid');
    if (!grid) return;
    grid.innerHTML = '';
    BP_COLORS.forEach(item => {
        const isOwned    = !!owned[item.id];
        const isEquipped = style.color === item.color;
        const finalPrice = discountedPrice(item.price, isPlus);
        const div = document.createElement('div');
        div.className = `shop-item ${isOwned ? 'owned' : ''}`;
        div.innerHTML = `
            <div class="shop-item-icon" style="color:${item.color}">🎨</div>
            <div class="shop-item-name">${esc(item.name)}</div>
            <div class="shop-item-desc">Couleur de ton pseudo dans le chat.</div>
            <div class="shop-item-price">${priceHTML(item, isPlus)}</div>
            ${isOwned
                ? `<button class="btn-bp" onclick="equipColor('${item.color}')" ${isEquipped ? 'disabled' : ''}>${isEquipped ? 'Équipé' : 'Équiper'}</button>`
                : `<button class="btn-bp" onclick="buyItem('${item.id}',${finalPrice},'color','${item.color}')">Acheter</button>`}`;
        grid.appendChild(div);
    });
}

function renderFontShop(owned, style, isPlus = false) {
    const grid = document.getElementById('shop-fonts-grid');
    if (!grid) return;
    grid.innerHTML = '';
    BP_FONTS.forEach(item => {
        const isOwned    = !!owned[item.id];
        const isEquipped = style.font === item.font;
        const finalPrice = discountedPrice(item.price, isPlus);
        const div = document.createElement('div');
        div.className = `shop-item ${isOwned ? 'owned' : ''}`;
        div.innerHTML = `
            <div class="shop-item-icon">✍️</div>
            <div class="shop-item-name">${esc(item.name)}</div>
            <div class="shop-item-desc" data-font="${item.font}" style="${item.font === 'syne' ? 'font-family:Syne,sans-serif' : item.font === 'mono' ? 'font-family:monospace' : 'font-family:Georgia,serif'}">${esc(item.preview)}</div>
            <div class="shop-item-price">${priceHTML(item, isPlus)}</div>
            ${isOwned
                ? `<button class="btn-bp" onclick="equipFont('${item.font}')" ${isEquipped ? 'disabled' : ''}>${isEquipped ? 'Équipé' : 'Équiper'}</button>`
                : `<button class="btn-bp" onclick="buyItem('${item.id}',${finalPrice},'font','${item.font}')">Acheter</button>`}`;
        grid.appendChild(div);
    });
}

function renderAnimShop(owned, style, isPlus = false) {
    const grid = document.getElementById('shop-anims-grid');
    if (!grid) return;
    grid.innerHTML = '';
    BP_ANIMS.forEach(item => {
        const isOwned    = !!owned[item.id];
        const isEquipped = style.anim === item.anim;
        const finalPrice = discountedPrice(item.price, isPlus);
        const div = document.createElement('div');
        div.className = `shop-item ${isOwned ? 'owned' : ''}`;
        div.innerHTML = `
            <div class="shop-item-icon">${item.emoji}</div>
            <div class="shop-item-name">${esc(item.name)}</div>
            <div class="shop-item-desc">Animation appliquée à ton pseudo.</div>
            <div class="shop-item-price">${priceHTML(item, isPlus)}</div>
            ${isOwned
                ? `<button class="btn-bp" onclick="equipAnim('${item.anim}')" ${isEquipped ? 'disabled' : ''}>${isEquipped ? 'Équipé' : 'Équiper'}</button>`
                : `<button class="btn-bp" onclick="buyItem('${item.id}',${finalPrice},'anim','${item.anim}')">Acheter</button>`}`;
        grid.appendChild(div);
    });
}

window.buyItem = async (itemId, price, type, value) => {
    const ok = await spendBP(price);
    if (!ok) { showNotif('❌', 'Pas assez de BP', `Il te faut ${price} BlabPoints.`); return; }
    await set(ref(db, `users/${uid()}/owned/${itemId}`), true);
    await update(ref(db, `users/${uid()}/style`), { [type]: value });
    showNotif('🎉', 'Achat réussi !', 'L\'item a été acheté et équipé.');
    openBPShop();
};

window.equipColor = async (color) => { await update(ref(db, `users/${uid()}/style`), { color }); openBPShop(); };
window.equipFont  = async (font)  => { await update(ref(db, `users/${uid()}/style`), { font });  openBPShop(); };
window.equipAnim  = async (anim)  => { await update(ref(db, `users/${uid()}/style`), { anim });  openBPShop(); };

/* ══════════════════════════════════════════════════════════════
   BLABPLUS
══════════════════════════════════════════════════════════════ */
window.openBlabPlusModal = async () => {
    openModal('modal-blabplus');
    const snap         = await get(ref(db, `users/${uid()}/blabplus`));
    const isSubscribed = snap.val() === true;

    document.getElementById('bplus-subscribed-view').style.display   = isSubscribed ? 'flex' : 'none';
    document.getElementById('bplus-unsubscribed-view').style.display = isSubscribed ? 'none' : 'flex';

    if (isSubscribed) renderFreeSkinGrid();
};

function renderFreeSkinGrid() {
    const grid = document.getElementById('bplus-free-skin-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const allItems = [...BP_COLORS, ...BP_FONTS, ...BP_ANIMS];
    allItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'bplus-skin-option';
        div.innerHTML = `<div class="skin-preview">${item.emoji || '🎨'}</div><div>${esc(item.name)}</div>`;
        div.onclick = (e) => {
            _selectedFreeSkin = item;
            grid.querySelectorAll('.bplus-skin-option').forEach(el => el.style.borderColor = '#1e1e1e');
            e.currentTarget.style.borderColor = '#888';
        };
        grid.appendChild(div);
    });
}

let _selectedFreeSkin = null;

window.claimFreeSkin = async () => {
    if (!_selectedFreeSkin) {
        showNotif('⚠️', 'Choisis un skin', 'Sélectionne d\'abord un skin dans la grille.');
        return;
    }
    const today    = new Date().toISOString().slice(0, 7);
    const lastSnap = await get(ref(db, `users/${uid()}/blabplusLastSkin`));
    if (lastSnap.val() === today) {
        showNotif('⏳', 'Déjà réclamé', 'Tu as déjà choisi ton skin gratuit ce mois-ci.');
        return;
    }
    const item  = _selectedFreeSkin;
    const type  = item.color ? 'color' : item.font ? 'font' : 'anim';
    const value = item.color || item.font || item.anim;
    await set(ref(db, `users/${uid()}/owned/${item.id}`), true);
    await update(ref(db, `users/${uid()}/style`), { [type]: value });
    await set(ref(db, `users/${uid()}/blabplusLastSkin`), today);
    _selectedFreeSkin = null;
    showNotif('🎉', 'Skin réclamé !', `"${item.name}" a été équipé gratuitement.`);
    closeModal('modal-blabplus');
};

window.subscribeBlabPlus = async () => {
    await set(ref(db, `users/${uid()}/blabplus`), true);
    delete _blabplusCache[uid()];
    await addBP(100);
    showNotif('🎉', 'Bienvenue dans Blab+ !', '+100 BP crédités. Profite de ton badge exclusif !');
    openBlabPlusModal();
    const myNameEl = document.getElementById('my-name');
    if (myNameEl) {
        myNameEl.parentNode.querySelectorAll('.blabplus-badge').forEach(b => b.remove());
        const bpBadge = document.createElement('span');
        bpBadge.className   = 'blabplus-badge inline';
        bpBadge.textContent = 'Blab+';
        myNameEl.parentNode.insertBefore(bpBadge, myNameEl.nextSibling);
    }
};

window.cancelBlabPlus = async () => {
    if (!confirm('Annuler ton abonnement Blab+ ?')) return;
    await set(ref(db, `users/${uid()}/blabplus`), false);
    delete _blabplusCache[uid()];
    showNotif('👋', 'Abonnement annulé', 'Tu repasseras en compte gratuit.');
    document.getElementById('my-name')?.parentNode
        ?.querySelectorAll('.blabplus-badge').forEach(b => b.remove());
    openBlabPlusModal();
};

/* ══════════════════════════════════════════════════════════════
   LEGACY COMPAT
══════════════════════════════════════════════════════════════ */
window.createNewChannel = () => {
    const name = prompt('Nom du salon ?');
    if (!name?.trim()) return;
    push(ref(db, `servers/${currentServerId}/channels`), {
        name: name.trim().toLowerCase().replace(/\s+/g, '-'), categoryId: null
    });
};
