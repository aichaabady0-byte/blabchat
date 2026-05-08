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

async function isServerVerified(serverId) {
    try {
        const snap = await get(ref(db, `servers/${serverId}/verified`));
        return snap.val() === true;
    } catch { return false; }
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
    } else {
        document.getElementById('page-discover')?.classList.add('active');
        document.getElementById('page-app')?.classList.remove('active');
    }
});

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
function initApp() {
    loadServers();
    switchView('global');
}

/* ══════════════════════════════════════════════════════════════
   VIEW SWITCHER
══════════════════════════════════════════════════════════════ */
window.switchView = (view) => {
    currentView = view;
    stopListeners();

    document.getElementById('nav-home')?.classList.toggle('active', view === 'global');
    document.getElementById('nav-dm')?.classList.toggle('active', view === 'dm');

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
            loadMessages('global', ch.id);
            closeMobileDrawer();
        };
        list.appendChild(div);
    });

    currentChannelId = 'general';
    const ccd = document.getElementById('current-channel-display');
    if (ccd) ccd.textContent = 'général';
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

    renderServerChannels(serverId);
    renderMembersServer(serverId);
}

function renderServerChannels(serverId) {
    const list       = document.getElementById('channel-list');
    const drawerList = document.getElementById('drawer-channel-list');
    if (
