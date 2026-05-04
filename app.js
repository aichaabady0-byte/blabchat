import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, onValue, serverTimestamp, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const db = getDatabase(app);
const auth = getAuth(app);

let currentServerId = 'global';
let currentChannelId = 'general';

// --- AUTH ---
window.showAuth = (type) => {
    document.getElementById('modal-container').classList.remove('hidden');
    document.getElementById('group-user').style.display = (type === 'login') ? 'none' : 'block';
    document.getElementById('auth-submit').onclick = () => handleAuth(type);
};
window.closeAuth = () => document.getElementById('modal-container').classList.add('hidden');

async function handleAuth(type) {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const user = document.getElementById('auth-user').value;
    try {
        if (type === 'register') {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: user });
            await set(ref(db, `users/${res.user.uid}`), { username: user, status: 'online' });
        } else { await signInWithEmailAndPassword(auth, email, pass); }
        closeAuth();
    } catch (e) { alert(e.message); }
}

window.logout = () => signOut(auth);

// --- NAVIGATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('page-discover').classList.remove('active');
        document.getElementById('page-app').classList.add('active');
        document.getElementById('my-name').innerText = user.displayName;
        document.getElementById('my-avatar').innerText = user.displayName[0].toUpperCase();
        initApp();
    } else {
        document.getElementById('page-discover').classList.add('active');
        document.getElementById('page-app').classList.remove('active');
    }
});

function initApp() {
    loadServers();
    loadChannels();
    loadMessages();
    loadMembers();
}

// --- SERVEURS & SALONS ---
window.createNewServer = () => {
    const name = prompt("Nom du serveur ?");
    if(name) push(ref(db, 'servers'), { name, icon: name[0].toUpperCase(), owner: auth.currentUser.uid });
};

function loadServers() {
    onValue(ref(db, 'servers'), (snap) => {
        const list = document.getElementById('server-list');
        list.innerHTML = '';
        snap.forEach(child => {
            const s = child.val();
            const div = document.createElement('div');
            div.className = `server-icon ${currentServerId === child.key ? 'active' : ''}`;
            div.innerText = s.icon;
            div.onclick = () => {
                currentServerId = child.key;
                document.getElementById('current-server-name').innerText = s.name.toUpperCase();
                loadChannels();
                loadMessages();
            };
            list.appendChild(div);
        });
    });
}

window.createNewChannel = () => {
    const name = prompt("Nom du salon ?");
    if(name) push(ref(db, `channels/${currentServerId}`), { name: name.toLowerCase() });
};

function loadChannels() {
    onValue(ref(db, `channels/${currentServerId}`), (snap) => {
        const list = document.getElementById('channel-list');
        list.innerHTML = '';
        snap.forEach(child => {
            const c = child.val();
            const div = document.createElement('div');
            div.className = `channel-item ${currentChannelId === child.key ? 'active' : ''}`;
            div.innerHTML = `<span class="channel-hash">#</span> ${c.name}`;
            div.onclick = () => {
                currentChannelId = child.key;
                document.getElementById('current-channel-display').innerText = c.name;
                loadMessages();
            };
            list.appendChild(div);
        });
    });
}

// --- CHAT ---
function loadMessages() {
    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML = ''; // Clear chat
    off(ref(db, `messages/${currentServerId}/${currentChannelId}`)); // Stop old listener
    
    onChildAdded(ref(db, `messages/${currentServerId}/${currentChannelId}`), (snap) => {
        const m = snap.val();
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg-line ${m.sender === auth.currentUser.displayName ? 'own-msg' : ''}`;
        msgDiv.innerHTML = `
            <div class="msg-avatar-col"><div class="msg-avatar">${m.sender[0]}</div></div>
            <div class="msg-content-col">
                <div class="msg-header"><span class="msg-sender">${m.sender}</span></div>
                <div class="msg-text">${m.text}</div>
            </div>`;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

document.getElementById('sendBtn').onclick = () => {
    const input = document.getElementById('msgInput');
    if(input.value) {
        push(ref(db, `messages/${currentServerId}/${currentChannelId}`), {
            sender: auth.currentUser.displayName,
            text: input.value,
            timestamp: serverTimestamp()
        });
        input.value = '';
    }
};

// --- MEMBRES & AMIS ---
function loadMembers() {
    onValue(ref(db, 'users'), (snap) => {
        const list = document.getElementById('members-list');
        list.innerHTML = '';
        snap.forEach(child => {
            const u = child.val();
            const div = document.createElement('div');
            div.className = 'member-item';
            div.innerHTML = `<div class="member-avatar">${u.username[0]}</div> <span>${u.username}</span>`;
            list.appendChild(div);
        });
    });
}

window.addFriend = () => {
    const name = document.getElementById('friendUser').value;
    alert("Demande envoyée à " + name + " (Logique à compléter)");
};
