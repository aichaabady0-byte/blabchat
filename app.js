import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const provider = new GoogleAuthProvider();

// Éléments UI
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authUI = document.getElementById('user-info');
const adminPanel = document.getElementById('admin-panel');
const adminBadge = document.getElementById('admin-badge');

let currentUser = null;

// --- AUTHENTIFICATION ---
loginBtn.onclick = () => signInWithPopup(auth, provider);
logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginBtn.classList.add('hidden');
        authUI.classList.remove('hidden');
        document.getElementById('display-name').innerText = user.displayName;

        // VERIFICATION SI C'EST FUFU
        if (user.displayName.includes("Fufu") || user.email === "tonemail@gmail.com") {
            adminPanel.classList.remove('hidden');
            adminBadge.classList.remove('hidden');
        }
    } else {
        currentUser = null;
        loginBtn.classList.remove('hidden');
        authUI.classList.add('hidden');
        adminPanel.classList.add('hidden');
    }
});

// --- GESTION SERVEURS ---
document.getElementById('addServerBtn').onclick = async () => {
    const sName = prompt("Nom du serveur ?");
    if (sName) {
        const inviteCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        const newServerRef = push(ref(db, 'servers'));
        await set(newServerRef, {
            name: sName,
            owner: currentUser.uid,
            code: inviteCode
        });
        alert(`Serveur créé ! Code d'invitation : ${inviteCode}`);
    }
};

// --- CHAT LOGIQUE ---
const chatRef = ref(db, 'messages');
const sendMessage = () => {
    const msg = document.getElementById('messageInput').value;
    if (msg && currentUser) {
        push(chatRef, {
            username: currentUser.displayName,
            text: msg,
            timestamp: serverTimestamp(),
            isVerified: !adminBadge.classList.contains('hidden')
        });
        document.getElementById('messageInput').value = "";
    }
};

document.getElementById('sendBtn').onclick = sendMessage;

onChildAdded(chatRef, (snapshot) => {
    const val = snapshot.val();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    msgDiv.innerHTML = `${val.isVerified ? '✅ ' : ''}<strong>${val.username}:</strong> ${val.text}`;
    document.getElementById('chat-box').appendChild(msgDiv);
});
