import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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

// --- VARIABLES D'ÉTAT ---
let currentServerId = 'global';
let currentChannelId = 'general';

// --- AUTHENTIFICATION ---
window.showAuth = (type) => {
    document.getElementById('modal-container').classList.remove('hidden');
    document.getElementById('group-user').style.display = (type === 'login') ? 'none' : 'flex';
    document.getElementById('modal-title').innerText = (type === 'login') ? 'Connexion' : 'Créer un compte';
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
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
        closeAuth();
    } catch (e) { alert(e.message); }
}

window.logout = () => {
    if(auth.currentUser) set(ref(db, `users/${auth.currentUser.uid}/status`), 'offline');
    signOut(auth);
};

// --- LOGIQUE CORE ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('page-discover').classList.remove('active');
        document.getElementById('page-app').classList.add('active');
        document.getElementById('my-name').innerText = user.displayName;
        document.getElementById('my-avatar').innerText = user.displayName[0].toUpperCase();
        
        // Mise à jour statut
        set(ref(db, `users/${user.uid}/status`), 'online');
        
        initApp();
    } else {
        document.getElementById('page-discover').classList.add('active');
        document.getElementById('page-app').classList.remove('active');
    }
});

function initApp() {
    loadServers();
    loadMessages();
    loadMembers();
}

// --- GESTION DES SERVEURS ---
window.createNewServer = async () => {
    const name = prompt("Nom du serveur ?");
    if(name) {
        const newServerRef = push(ref(db, 'servers'));
        await set(newServerRef, {
            name: name,
            owner: auth.currentUser.uid,
            icon: name[0].toUpperCase()
        });
    }
};

function loadServers() {
    const serverList = document.getElementById('server-list');
    onValue(ref(db, 'servers'), (snapshot) => {
        serverList.innerHTML = '';
        snapshot.forEach((child) => {
            const s = child.val();
            const div = document.createElement('div');
            div.className = `server-icon ${currentServerId === child.key ? 'active' : ''}`;
            div.innerText = s.icon;
            div.onclick = () => { currentServerId = child.key; loadServers(); };
            serverList.appendChild(div);
        });
    });
}

// --- GESTION DES MEMBRES ---
function loadMembers() {
    const membersList = document.getElementById('members-list');
    onValue(ref(db, 'users'), (snapshot) => {
        membersList.innerHTML = '';
        snapshot.forEach((child) => {
            const u = child.val();
            if(u.status === 'online') {
                const div = document.createElement('div');
                div.className = 'member-item';
                div.innerHTML = `
                    <div class="member-avatar">${u.username[0]}</div>
                    <span class="member-name">${u.username}</span>
                `;
                membersList.appendChild(div);
            }
        });
    });
}

// --- CHAT ---
function loadMessages() {
    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML = '';
    onChildAdded(ref(db, `messages/${currentServerId}`), (snapshot) => {
        const m = snapshot.val();
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg-line ${m.sender === auth.currentUser?.displayName ? 'own-msg' : ''}`;
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

window.sendMessage = () => {
    const input = document.getElementById('msgInput');
    if(input.value && auth.currentUser) {
        push(ref(db, `messages/${currentServerId}`), {
            sender: auth.currentUser.displayName,
            text: input.value,
            timestamp: serverTimestamp()
        });
        input.value = "";
    }
};

document.getElementById('sendBtn').onclick = window.sendMessage;
