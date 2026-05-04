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
window.showModal = (type) => {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('auth-user').classList.toggle('hidden', type === 'login');
    document.getElementById('modal-title').innerText = type === 'login' ? 'Connexion' : 'Inscription';
    document.getElementById('auth-submit').onclick = () => handleAuth(type);
};
window.closeModal = () => document.getElementById('modal-overlay').classList.add('hidden');

// --- AUTHENTIFICATION RÉELLE ---
async function handleAuth(type) {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const user = document.getElementById('auth-user').value;

    try {
        if (type === 'register') {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: user });
            await set(ref(db, `users/${user}`), { uid: res.user.uid, email: email });
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
        closeModal();
    } catch (e) { alert(e.message); }
}

window.logout = () => signOut(auth);

// --- SURVEILLANCE ÉTAT ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('page-discover').classList.remove('active');
        document.getElementById('page-app').classList.add('active');
        document.getElementById('user-display').innerText = user.displayName;
        
        if(user.displayName === "Fufu") {
            document.getElementById('admin-panel').classList.remove('hidden');
            document.getElementById('verified-badge').classList.remove('hidden');
        }
    } else {
        document.getElementById('page-discover').classList.add('active');
        document.getElementById('page-app').classList.remove('active');
    }
});

// --- SYSTÈME D'AMIS PAR USERNAME ---
document.getElementById('addFriendBtn').onclick = async () => {
    const target = document.getElementById('friendUser').value;
    const snapshot = await get(ref(db, `users/${target}`));
    if (snapshot.exists()) {
        await set(ref(db, `friends/${auth.currentUser.displayName}/${target}`), true);
        alert("Ami ajouté !");
    } else {
        alert("Utilisateur introuvable.");
    }
};

// --- CHAT ---
const chatRef = ref(db, 'messages');
document.getElementById('sendBtn').onclick = () => {
    const text = document.getElementById('msgInput').value;
    if(text) {
        push(chatRef, { sender: auth.currentUser.displayName, text, time: serverTimestamp() });
        document.getElementById('msgInput').value = "";
    }
};

onChildAdded(chatRef, (s) => {
    const m = s.val();
    const div = document.createElement('div');
    div.className = "msg-line";
    div.innerHTML = `<b>${m.sender}:</b> ${m.text}`;
    document.getElementById('chat-messages').appendChild(div);
});
