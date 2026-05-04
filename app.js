import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, get, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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

// --- NAVIGATION & MODALES ---
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
    const errorEl = document.getElementById('auth-error');

    try {
        if (type === 'register') {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: user });
            await set(ref(db, `users/${user}`), { uid: res.user.uid, email });
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
        closeAuth();
    } catch (e) {
        errorEl.innerText = e.message;
        errorEl.classList.remove('hidden');
    }
}

window.logout = () => signOut(auth);

// --- ÉTAT DE CONNEXION ---
onAuthStateChanged(auth, (user) => {
    const pageDiscover = document.getElementById('page-discover');
    const pageApp = document.getElementById('page-app');

    if (user) {
        pageDiscover.classList.remove('active');
        pageApp.classList.add('active');
        document.getElementById('my-name').innerText = user.displayName;
        document.getElementById('my-avatar').innerText = user.displayName[0].toUpperCase();

        // Admin Check
        if(user.displayName === "Fufu") {
            document.getElementById('admin-panel').classList.remove('hidden');
            document.getElementById('my-status').innerHTML = '<span class="badge-verify">VERIFIED</span>';
        }
    } else {
        pageDiscover.classList.add('active');
        pageApp.classList.remove('active');
    }
});

// --- CHAT LOGIQUE ---
const chatRef = ref(db, 'messages');
document.getElementById('sendBtn').onclick = sendMessage;
document.getElementById('msgInput').onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };

function sendMessage() {
    const text = document.getElementById('msgInput').value;
    if(text && auth.currentUser) {
        push(chatRef, {
            sender: auth.currentUser.displayName,
            text: text,
            timestamp: serverTimestamp(),
            isAdmin: (auth.currentUser.displayName === "Fufu")
        });
        document.getElementById('msgInput').value = "";
    }
}

onChildAdded(chatRef, (snapshot) => {
    const m = snapshot.val();
    const chatBox = document.getElementById('chat-messages');
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg-line first-in-group ${m.sender === auth.currentUser?.displayName ? 'own-msg' : ''}`;
    
    msgDiv.innerHTML = `
        <div class="msg-avatar-col">
            <div class="msg-avatar ${m.isAdmin ? 'admin-avatar' : ''}">${m.sender[0].toUpperCase()}</div>
        </div>
        <div class="msg-content-col">
            <div class="msg-header">
                <span class="msg-sender ${m.isAdmin ? 'is-admin' : ''}">${m.sender}</span>
                <span class="msg-time">aujourd'hui</span>
            </div>
            <div class="msg-text">${m.text}</div>
        </div>
    `;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
});
