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

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
const auth = getAuth(app);

/* ══════════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════════ */
let currentView       = 'global';   // 'global' | 'dm' | serverID
let currentServerId   = 'global';
let currentChannelId  = 'general';
let currentDmUserId   = null;
let pendingJoinServer = null;        // { id, data } serveur à confirmer
let activeListeners   = [];          // pour nettoyer les listeners Firebase

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function esc(str = '') {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function uid() { return auth.currentUser?.uid || null; }
function me()  { return auth.currentUser?.displayName || '?'; }

function dmChannelId(uid1, uid2) {
    return [uid1, uid2].sort().join('__');
}

function showNotif(icon, title, text, duration = 4000) {
    const container = document.getElementById('notif-container');
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
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }

/* tab switcher */
window.switchTab = (group, targetId) => {
    const modal = document.getElementById(`tab-${targetId.replace('tab-','').split('-')[0]}`)?.closest('.modal')
        || document.querySelector('.modal-overlay:not(.hidden) .modal');
    if (!modal) return;
    modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    modal.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(targetId)?.classList.add('active');
    event.target.classList.add('active');
};

/* ══════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════ */
window.showAuth = (type) => {
    openModal('modal-auth');
    document.getElementById('group-user').style.display = type === 'login' ? 'none' : 'block';
    document.getElementById('modal-title').textContent = type === 'login' ? 'Connexion' : 'Créer un compte';
    document.getElementById('auth-submit').onclick = () => handleAuth(type);
};

async function handleAuth(type) {
    const email = document.getElementById('auth-email').value.trim();
    const pass  = document.getElementById('auth-pass').value;
    const user  = document.getElementById('auth-user').value.trim();
    try {
        if (type === 'register') {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: user });
            await set(ref(db, `users/${res.user.uid}`), {
                username: user, email, status: 'online', createdAt: Date.now()
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
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('page-discover').classList.remove('active');
        document.getElementById('page-app').classList.add('active');
        document.getElementById('my-name').textContent = user.displayName;
        document.getElementById('my-avatar').textContent = user.displayName[0].toUpperCase();
        document.getElementById('drawer-my-name').textContent = user.displayName;
        document.getElementById('drawer-my-avatar').textContent = user.displayName[0].toUpperCase();
        initApp();
        listenFriendRequests();
        checkInviteInUrl();
    } else {
        document.getElementById('page-discover').classList.add('active');
        document.getElementById('page-app').classList.remove('active');
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

    if (view === 'dm') {
        renderDmSidebar();
        showWelcomeScreen('💬', 'Messages privés', 'Sélectionne un ami pour lui écrire.');
        document.getElementById('current-server-name').textContent = 'MESSAGES';
        document.getElementById('channel-header-actions').innerHTML = '';
        document.getElementById('main-header-actions').innerHTML = '';
        document.getElementById('members-list').innerHTML = '';
    } else if (view === 'global') {
        currentServerId = 'global';
        document.getElementById('current-server-name').textContent = 'GLOBAL';
        document.getElementById('channel-header-actions').innerHTML =
            `<button class="btn-icon" onclick="openSearchServers()" title="Rejoindre un serveur">🔍</button>`;
        renderGlobalChannels();
        renderMembersGlobal();
        document.getElementById('main-header-actions').innerHTML = '';
    } else {
        // it's a server
        currentServerId = view;
        loadServerView(view);
    }
};

function showWelcomeScreen(icon, title, sub) {
    const box = document.getElementById('chat-messages');
    box.innerHTML = `<div class="welcome-screen"><div style="font-size:3rem">${icon}</div><h2>${esc(title)}</h2><p style="color:var(--txt-3)">${esc(sub)}</p></div>`;
    document.getElementById('current-channel-display').textContent = title;
    document.getElementById('chat-input-area').style.display = 'none';
}

/* ══════════════════════════════════════════════════════════════
   GLOBAL CHANNELS
══════════════════════════════════════════════════════════════ */
function renderGlobalChannels() {
    const list = document.getElementById('channel-list');
    list.innerHTML = '';

    // default channels in global
    const defaults = [
        { id: 'general', name: 'général' },
        { id: 'random',  name: 'random' },
        { id: 'annonces', name: 'annonces' },
    ];

    const label = document.createElement('div');
    label.className = 'sidebar-section-label';
    label.innerHTML = '<span>SALONS</span>';
    list.appendChild(label);

    defaults.forEach(ch => {
        const div = document.createElement('div');
        div.className = `channel-item ${currentChannelId === ch.id ? 'active' : ''}`;
        div.innerHTML = `<span class="channel-hash">#</span> ${esc(ch.name)}`;
        div.onclick = () => {
            currentChannelId = ch.id;
            document.querySelectorAll('.channel-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            document.getElementById('current-channel-display').textContent = ch.name;
            loadMessages('global', ch.id);
        };
        list.appendChild(div);
    });

    // auto-load first
    currentChannelId = 'general';
    document.getElementById('current-channel-display').textContent = 'général';
    loadMessages('global', 'general');
    document.getElementById('chat-input-area').style.display = '';
}

/* ══════════════════════════════════════════════════════════════
   SERVER VIEW
══════════════════════════════════════════════════════════════ */
async function loadServerView(serverId) {
    const snap = await get(ref(db, `servers/${serverId}`));
    if (!snap.exists()) return;
    const serverData = snap.val();

    document.getElementById('current-server-name').textContent = serverData.name.toUpperCase();

    // check if user is member
    const memberSnap = await get(ref(db, `servers/${serverId}/members/${uid()}`));
    if (!memberSnap.exists()) {
        showWelcomeScreen('🔒', 'Accès refusé', 'Tu n\'es pas membre de ce serveur.');
        document.getElementById('channel-list').innerHTML = '';
        return;
    }

    // header actions
    const isOwner = serverData.owner === uid();
    document.getElementById('channel-header-actions').innerHTML =
        isOwner ? `<button class="btn-icon" onclick="openAdminPanel()" title="Administration">⚙️</button>` : '';
    document.getElementById('main-header-actions').innerHTML =
        `<button class="btn-icon" onclick="openSearchServers()" title="Rejoindre un serveur">🔍</button>`;

    renderServerChannels(serverId);
    renderMembersServer(serverId);
}

function renderServerChannels(serverId) {
    const list = document.getElementById('channel-list');
    list.innerHTML = '';

    onValue(ref(db, `servers/${serverId}/categories`), (catSnap) => {
        list.innerHTML = '';
        const categories = {};
        catSnap.forEach(c => { categories[c.key] = c.val(); });

        // uncategorized label
        const uncatLabel = document.createElement('div');
        uncatLabel.className = 'sidebar-section-label';
        uncatLabel.innerHTML = '<span>SALONS</span>';
        list.appendChild(uncatLabel);

        onValue(ref(db, `servers/${serverId}/channels`), (chanSnap) => {
            list.innerHTML = '';

            // Group by category
            const byCat = {};
            chanSnap.forEach(ch => {
                const d = ch.val();
                const cat = d.categoryId || 'none';
                if (!byCat[cat]) byCat[cat] = [];
                byCat[cat].push({ id: ch.key, ...d });
            });

            // Render categories
            Object.entries(categories).forEach(([catId, catData]) => {
                const catDiv = document.createElement('div');
                catDiv.className = 'channel-category';
                catDiv.innerHTML = `<span class="channel-category-name">▾ ${esc(catData.name)}</span>`;
                list.appendChild(catDiv);

                (byCat[catId] || []).forEach(ch => appendChannelItem(list, ch, serverId));
            });

            // No category
            if (byCat['none']?.length) {
                const noCatLabel = document.createElement('div');
                noCatLabel.className = 'channel-category';
                noCatLabel.innerHTML = '<span class="channel-category-name">▾ GÉNÉRAL</span>';
                list.appendChild(noCatLabel);
                byCat['none'].forEach(ch => appendChannelItem(list, ch, serverId));
            }

            // Auto-select first channel if none selected
            if (!currentChannelId || list.querySelector('.channel-item')) {
                const first = list.querySelector('.channel-item');
                if (first) first.click();
            }
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
        document.getElementById('current-channel-display').textContent = ch.name;
        loadMessages(serverId, ch.id);
    };
    list.appendChild(div);
}

/* ══════════════════════════════════════════════════════════════
   MESSAGES
══════════════════════════════════════════════════════════════ */
function loadMessages(serverId, channelId) {
    stopListeners();
    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML = '';
    document.getElementById('chat-input-area').style.display = '';

    const msgPath = `messages/${serverId}/${channelId}`;
    let lastDate = null;
    let lastSender = null;

    const listener = onChildAdded(ref(db, msgPath), (snap) => {
        const m = snap.val();
        if (!m) return;

        // Date divider
        const msgDate = m.timestamp ? new Date(m.timestamp).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : null;
        if (msgDate && msgDate !== lastDate) {
            const div = document.createElement('div');
            div.className = 'date-divider';
            div.innerHTML = `<span>${msgDate}</span>`;
            chatBox.appendChild(div);
            lastDate = msgDate;
        }

        const isOwn = m.sender === me();
        const showAvatar = m.sender !== lastSender;
        lastSender = m.sender;

        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '';

        const msgDiv = document.createElement('div');
        msgDiv.className = `msg-line ${isOwn ? 'own-msg' : ''}`;
        msgDiv.innerHTML = `
            <div class="msg-avatar-col">
                ${showAvatar ? `<div class="msg-avatar">${esc(m.sender[0])}</div>` : ''}
            </div>
            <div class="msg-content-col">
                ${showAvatar ? `<div class="msg-header"><span class="msg-sender">${esc(m.sender)}</span><span class="msg-time">${time}</span></div>` : ''}
                <div class="msg-text">${formatMessage(m.text)}</div>
            </div>`;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    activeListeners.push([msgPath, listener]);
}

function formatMessage(text) {
    if (!text) return '';
    // basic URL linkify
    return esc(text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

document.getElementById('sendBtn').onclick = sendMessage;
document.getElementById('msgInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text || !auth.currentUser) return;

    if (currentDmUserId && currentView === 'dm') {
        const dmId = dmChannelId(uid(), currentDmUserId);
        push(ref(db, `dm/${dmId}`), {
            sender: me(), senderId: uid(), text, timestamp: serverTimestamp()
        });
    } else {
        push(ref(db, `messages/${currentServerId}/${currentChannelId}`), {
            sender: me(), senderId: uid(), text, timestamp: serverTimestamp()
        });
    }
    input.value = '';
}

/* ══════════════════════════════════════════════════════════════
   SERVERS
══════════════════════════════════════════════════════════════ */
function loadServers() {
    onValue(ref(db, 'servers'), (snap) => {
        const list = document.getElementById('server-list');
        const dlist = document.getElementById('drawer-server-list');
        list.innerHTML = '';
        dlist.innerHTML = '';

        snap.forEach(child => {
            const s = child.val();
            const isMember = s.members && s.members[uid()];
            if (!isMember) return;

            [list, dlist].forEach(container => {
                const div = document.createElement('div');
                div.className = `server-icon ${currentServerId === child.key ? 'active' : ''}`;
                div.innerText = s.icon || s.name[0].toUpperCase();
                div.title = s.name;
                div.onclick = () => switchView(child.key);
                container.appendChild(div);
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
        inviteCode: generateInviteCode()
    });
    // create default channel
    await push(ref(db, `servers/${newRef.key}/channels`), { name: 'général', categoryId: null });
    switchView(newRef.key);
};

function generateInviteCode(len = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/* ══════════════════════════════════════════════════════════════
   JOIN SERVER
══════════════════════════════════════════════════════════════ */
window.openSearchServers = () => {
    openModal('modal-search-servers');
    document.getElementById('server-search-results').innerHTML = '<div class="empty-state">Tape pour chercher...</div>';
    document.getElementById('server-search-input').value = '';
};

window.searchServers = async (query) => {
    const results = document.getElementById('server-search-results');
    if (!query.trim()) { results.innerHTML = '<div class="empty-state">Tape pour chercher...</div>'; return; }
    results.innerHTML = '<div class="empty-state">Recherche...</div>';

    const snap = await get(ref(db, 'servers'));
    const found = [];
    snap.forEach(child => {
        const s = child.val();
        if (s.name.toLowerCase().includes(query.toLowerCase())) {
            found.push({ id: child.key, ...s });
        }
    });

    if (!found.length) { results.innerHTML = '<div class="empty-state">Aucun serveur trouvé.</div>'; return; }
    results.innerHTML = '';
    found.forEach(s => {
        const isMember = s.members && s.members[uid()];
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="friend-card-avatar" style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700">${esc(s.icon || s.name[0])}</div>
            <div style="flex:1"><div style="font-weight:600;font-size:.9rem">${esc(s.name)}</div><div style="font-size:.75rem;color:var(--txt-3)">${Object.keys(s.members||{}).length} membre(s)</div></div>
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

    document.getElementById('join-confirm-icon').textContent = snap.val().icon || snap.val().name[0];
    document.getElementById('join-confirm-name').textContent = snap.val().name;
    document.getElementById('join-confirm-desc').textContent =
        `Voulez-vous rejoindre le serveur "${snap.val().name}" ?`;

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
    const raw = document.getElementById('invite-link-input').value.trim();
    const code = raw.includes('/') ? raw.split('/').pop() : raw;
    if (!code) return;

    const snap = await get(ref(db, 'servers'));
    let found = null;
    snap.forEach(child => {
        const s = child.val();
        if (s.inviteCode === code.toUpperCase()) found = { id: child.key, data: s };
    });

    if (!found) { showNotif('❌', 'Lien invalide', 'Aucun serveur trouvé avec ce code.'); return; }
    pendingJoinServer = found;
    document.getElementById('join-confirm-icon').textContent = found.data.icon || found.data.name[0];
    document.getElementById('join-confirm-name').textContent = found.data.name;
    document.getElementById('join-confirm-desc').textContent =
        `Voulez-vous rejoindre le serveur "${found.data.name}" ?`;
    closeModal('modal-search-servers');
    openModal('modal-join-confirm');
};

function checkInviteInUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (code) {
        document.getElementById('invite-link-input').value = code;
        openModal('modal-search-servers');
        // switch to invite tab
        document.getElementById('tab-search-sv').classList.remove('active');
        document.getElementById('tab-invite').classList.add('active');
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
    const snap = await get(ref(db, `servers/${currentServerId}/categories`));
    const list = document.getElementById('admin-category-list');
    const select = document.getElementById('admin-channel-category');
    list.innerHTML = '';
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
        opt.value = child.key;
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
    const name = document.getElementById('admin-channel-name').value.trim();
    const categoryId = document.getElementById('admin-channel-category').value || null;
    if (!name) return;
    await push(ref(db, `servers/${currentServerId}/channels`), {
        name: name.toLowerCase().replace(/\s+/g, '-'), categoryId
    });
    document.getElementById('admin-channel-name').value = '';
    showNotif('✅', 'Salon créé', `#${name} a été créé.`);
};

async function loadAdminRoles() {
    const snap = await get(ref(db, `servers/${currentServerId}/roles`));
    const list = document.getElementById('admin-role-list');
    list.innerHTML = '';
    if (!snap.exists()) { list.innerHTML = '<div class="empty-state">Aucun rôle créé.</div>'; return; }
    snap.forEach(child => {
        const r = child.val();
        const div = document.createElement('div');
        div.className = 'role-item';
        div.innerHTML = `
            <div class="role-color" style="background:${esc(r.color || '#888')}"></div>
            <span class="role-name">${esc(r.name)}</span>
            <div style="display:flex;gap:4px;margin-left:auto">
                <button class="btn-ghost" style="font-size:.75rem;padding:4px 8px" onclick="editRolePermissions('${child.key}')">Perms</button>
                <button class="btn-danger" style="padding:4px 10px;font-size:.75rem" onclick="deleteRole('${child.key}')">✕</button>
            </div>`;
        list.appendChild(div);
    });
}

window.adminCreateRole = async () => {
    const name  = document.getElementById('new-role-name').value.trim();
    const color = document.getElementById('new-role-color').value;
    if (!name) return;
    const permissions = {
        manageChannels:  document.getElementById('perm-manage-channels').checked,
        manageMembers:   document.getElementById('perm-manage-members').checked,
        deleteMessages:  document.getElementById('perm-delete-messages').checked,
        sendMessages:    document.getElementById('perm-send-messages').checked,
    };
    await push(ref(db, `servers/${currentServerId}/roles`), { name, color, permissions });
    document.getElementById('new-role-name').value = '';
    showNotif('✅', 'Rôle créé', `Le rôle "${name}" a été créé.`);
    loadAdminRoles();
};

window.deleteRole = async (roleId) => {
    await remove(ref(db, `servers/${currentServerId}/roles/${roleId}`));
    loadAdminRoles();
};

window.editRolePermissions = async (roleId) => {
    const snap = await get(ref(db, `servers/${currentServerId}/roles/${roleId}`));
    if (!snap.exists()) return;
    const r = snap.val();
    // Simple inline update
    const perms = r.permissions || {};
    ['manage-channels','manage-members','delete-messages','send-messages'].forEach(p => {
        const key = p.replace(/-([a-z])/g, (_,c) => c.toUpperCase());
        const el = document.getElementById(`perm-${p}`);
        if (el) el.checked = !!perms[key];
    });
    showNotif('ℹ️', 'Permissions', `Modifie et recrée le rôle pour l'instant.`);
};

async function loadAdminMembers() {
    const snap = await get(ref(db, `servers/${currentServerId}/members`));
    const rolesSnap = await get(ref(db, `servers/${currentServerId}/roles`));
    const list = document.getElementById('admin-members-list');
    list.innerHTML = '';

    const roles = {};
    rolesSnap.forEach(r => { roles[r.key] = r.val(); });

    const userIds = [];
    snap.forEach(m => userIds.push({ uid: m.key, ...m.val() }));

    for (const member of userIds) {
        const userSnap = await get(ref(db, `users/${member.uid}`));
        if (!userSnap.exists()) continue;
        const u = userSnap.val();
        const div = document.createElement('div');
        div.className = 'friend-card';
        div.innerHTML = `
            <div class="friend-card-avatar">${esc(u.username[0])}</div>
            <div class="friend-card-info">
                <div class="friend-card-name">${esc(u.username)}</div>
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
    let code = snap.val();
    if (!code) {
        code = generateInviteCode();
        await set(ref(db, `servers/${currentServerId}/inviteCode`), code);
    }
    const link = `${window.location.origin}${window.location.pathname}?invite=${code}`;
    document.getElementById('invite-link-display').textContent = link;
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
        list.innerHTML = '';
        snap.forEach(child => {
            const u = child.val();
            const div = document.createElement('div');
            div.className = 'member-item';
            div.innerHTML = `
                <div class="member-avatar">${esc(u.username[0])}
                    <div class="member-status ${u.status === 'online' ? '' : 'offline'}"></div>
                </div>
                <span class="member-name">${esc(u.username)}</span>`;
            div.onclick = () => openDmWith(child.key, u.username);
            list.appendChild(div);
        });
    });
}

async function renderMembersServer(serverId) {
    const snap = await get(ref(db, `servers/${serverId}/members`));
    const rolesSnap = await get(ref(db, `servers/${serverId}/roles`));
    const list = document.getElementById('members-list');
    list.innerHTML = '';

    const roles = {};
    rolesSnap.forEach(r => { roles[r.key] = r.val(); });

    const promises = [];
    snap.forEach(m => {
        promises.push(
            get(ref(db, `users/${m.key}`)).then(u => ({ uid: m.key, member: m.val(), user: u.val() }))
        );
    });

    const all = await Promise.all(promises);
    all.forEach(({ uid: memberId, member, user }) => {
        if (!user) return;
        const div = document.createElement('div');
        div.className = 'member-item';
        const role = member.roleId && roles[member.roleId];
        div.innerHTML = `
            <div class="member-avatar">${esc(user.username[0])}
                <div class="member-status ${user.status === 'online' ? '' : 'offline'}"></div>
            </div>
            <span class="member-name">${esc(user.username)}</span>
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
    list.innerHTML = '<div class="sidebar-section-label"><span>MESSAGES PRIVÉS</span></div>';
    document.getElementById('members-list').innerHTML = '';

    // Listen to friends list to show DM shortcuts
    onValue(ref(db, `users/${uid()}/friends`), async (snap) => {
        list.querySelectorAll('.dm-item').forEach(el => el.remove());
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
                <span class="dm-name">${esc(user.username)}</span>`;
            div.onclick = () => openDmWith(fid, user.username);
            list.appendChild(div);
        });

        if (!friends.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.style.padding = '20px 12px';
            empty.textContent = 'Aucun ami encore. Ajoutes-en !';
            list.appendChild(empty);
        }
    });
}

function openDmWith(userId, username) {
    currentDmUserId = userId;
    currentView = 'dm';

    document.getElementById('nav-dm').classList.add('active');
    document.getElementById('current-channel-display').textContent = username;
    document.getElementById('chat-input-area').style.display = '';
    document.getElementById('main-header-actions').innerHTML =
        `<span style="font-size:.8rem;color:var(--txt-3)">💬 Message privé</span>`;

    document.querySelectorAll('.dm-item').forEach(el => el.classList.remove('active'));

    const dmId = dmChannelId(uid(), userId);
    loadMessages('dm', dmId);
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
    const snap = await get(ref(db, `users/${uid()}/friends`));
    const container = document.getElementById('tab-myfriends');
    container.innerHTML = '';

    if (!snap.exists()) { container.innerHTML = '<div class="empty-state">Aucun ami pour l\'instant.</div>'; return; }

    const promises = [];
    snap.forEach(child => {
        if (child.val() === 'accepted') {
            promises.push(get(ref(db, `users/${child.key}`)).then(u => ({ uid: child.key, user: u.val() })));
        }
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
                <div class="friend-card-name">${esc(user.username)}</div>
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
    container.innerHTML = '';

    const snap = await get(ref(db, `users/${uid()}/friendRequests`));
    if (!snap.exists()) { container.innerHTML = '<div class="empty-state">Aucune demande en attente.</div>'; return; }

    const promises = [];
    snap.forEach(child => {
        if (child.val() === 'pending') {
            promises.push(get(ref(db, `users/${child.key}`)).then(u => ({ uid: child.key, user: u.val() })));
        }
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
                <div class="friend-card-name">${esc(user.username)}</div>
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
            <div style="flex:1"><div style="font-weight:600;font-size:.9rem">${esc(u.username)}</div><div style="font-size:.75rem;color:var(--txt-3)">${esc(u.email || '')}</div></div>
            <button class="btn-primary" style="font-size:.8rem;padding:6px 12px" onclick="sendFriendRequest('${child.key}','${esc(u.username)}')">+ Ami</button>`;
        results.appendChild(div);
    });

    if (!count) results.innerHTML = '<div class="empty-state">Aucun utilisateur trouvé.</div>';
};

window.sendFriendRequest = async (targetId, targetName) => {
    // write request in target's node
    await set(ref(db, `users/${targetId}/friendRequests/${uid()}`), 'pending');
    showNotif('📨', 'Demande envoyée', `Demande d'amitié envoyée à ${targetName}.`);
};

window.acceptFriendRequest = async (requesterId, requesterName) => {
    // mutual friendship
    await set(ref(db, `users/${uid()}/friends/${requesterId}`), 'accepted');
    await set(ref(db, `users/${requesterId}/friends/${uid()}`), 'accepted');
    // clear request
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

/* Listen for new friend requests (real-time) */
function listenFriendRequests() {
    onChildAdded(ref(db, `users/${uid()}/friendRequests`), async (snap) => {
        if (snap.val() !== 'pending') return;
        const userSnap = await get(ref(db, `users/${snap.key}`));
        if (!userSnap.exists()) return;
        const u = userSnap.val();
        showNotif('👥', 'Demande d\'ami', `${u.username} veut être ton ami !`);
    });
}

/* ══════════════════════════════════════════════════════════════
   LEGACY COMPAT (called from HTML if needed)
══════════════════════════════════════════════════════════════ */
window.createNewChannel = () => {
    const name = prompt('Nom du salon ?');
    if (!name?.trim()) return;
    push(ref(db, `servers/${currentServerId}/channels`), { name: name.trim().toLowerCase().replace(/\s+/g,'-'), categoryId: null });
};
