import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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

// Éléments de navigation
const pageDiscover = document.getElementById('page-discover');
const pageChat = document.getElementById('page-chat');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userProfile = document.getElementById('user-profile');
const adminPanel = document.getElementById('admin-panel');

// --- SYSTÈME DE ROUTING ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Connecté : On va au Chat
        pageDiscover.classList.add('hidden');
        pageChat.classList.remove('hidden');
        loginBtn.classList.add('hidden');
        userProfile.classList.remove('hidden');
        document.getElementById('user-name').innerText = user.displayName;

        // Condition spéciale pour FUFU
        if (user.displayName.toLowerCase().includes("fufu")) {
            adminPanel.classList.remove('hidden');
            console.log("Bienvenue Admin Fufu");
        }
    } else {
        // Déconnecté : Retour au Discover
        pageDiscover.classList.remove('hidden');
        pageChat.classList.add('hidden');
        loginBtn.classList.remove('hidden');
        userProfile.classList.add('hidden');
    }
});

// --- ACTIONS ---
loginBtn.onclick = () => signInWithPopup(auth, provider);
logoutBtn.onclick = () => signOut(auth);

// --- CHAT LOGIQUE (Simplifiée) ---
const chatRef = ref(db, 'messages');
document.getElementById('sendBtn').onclick = () => {
    const msg = document.getElementById('messageInput').value;
    if(msg) {
        push(chatRef, { username: auth.currentUser.displayName, text: msg, timestamp: serverTimestamp() });
        document.getElementById('messageInput').value = "";
    }
};

onChildAdded(chatRef, (snap) => {
    const div = document.createElement('div');
    div.innerHTML = `<b>${snap.val().username}</b>: ${snap.val().text}`;
    document.getElementById('chat-messages').appendChild(div);
});
