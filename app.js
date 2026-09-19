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
    { id: 'color-pink',   name: 'Rose Vif',     color: '#e05bf0', price: 10 },
    { id: 'color-green',  name: 'Vert Émeraude', color: '#3fd68f', price: 10 },
    { id: 'color-red',    name: 'Rouge Feu',     color: '#f05b5b', price: 15 },
    { id: 'color-gold',   name: 'Or',            color: '#f5c842', price: 20 },
    { id: 'color-orange', name: 'Orange',        color: '#f09d28', price: 15 },
];

const BP_FONTS = [
    { id: 'font-syne',  name: 'Syne Bold',    font: 'syne',  price: 20, preview: 'Syne' },
    { id: 'font-mono',  name: 'Monospace',    font: 'mono',  price: 15, preview: 'Mono' },
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
