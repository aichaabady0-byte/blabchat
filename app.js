import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// On récupère la config depuis notre serveur Render pour ne pas l'exposer sur GitHub
async function startChat() {
    const response = await fetch('/config');
    const firebaseConfig = await response.json();

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const chatRef = ref(db, 'messages');

    // ... (Le reste de ton code de gestion des messages reste le même)
    setupChatLogic(chatRef);
}

function setupChatLogic(chatRef) {
    const messageInput = document.getElementById('messageInput');
    const usernameInput = document.getElementById('username');
    const sendBtn = document.getElementById('sendBtn');
    const chatBox = document.getElementById('chat-box');

    const sendMessage = () => {
        const user = usernameInput.value.trim() || "Anonyme";
        const msg = messageInput.value.trim();
        if (msg !== "") {
            push(chatRef, { username: user, text: msg, timestamp: serverTimestamp() });
            messageInput.value = "";
        }
    };

    sendBtn.onclick = sendMessage;
    messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

    onChildAdded(chatRef, (snapshot) => {
        const val = snapshot.val();
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        msgDiv.innerHTML = `<strong>${val.username}</strong>${val.text}`;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

startChat();
