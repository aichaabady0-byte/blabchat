import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Fonction principale pour démarrer le chat
async function init() {
    try {
        // 1. On va chercher la config sur ton serveur Render
        const response = await fetch('/config');
        const firebaseConfig = await response.json();

        // 2. On vérifie qu'on a bien reçu les clés
        if (!firebaseConfig.apiKey) {
            console.error("L'API n'a pas renvoyé de clés. Vérifie tes variables sur Render !");
            return;
        }

        // 3. Initialisation Firebase
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const chatRef = ref(db, 'messages');

        const messageInput = document.getElementById('messageInput');
        const usernameInput = document.getElementById('username');
        const sendBtn = document.getElementById('sendBtn');
        const chatBox = document.getElementById('chat-box');

        // 4. Logique d'envoi
        const sendMessage = () => {
            const user = usernameInput.value.trim() || "Anonyme";
            const msg = messageInput.value.trim();
            if (msg !== "") {
                push(chatRef, {
                    username: user,
                    text: msg,
                    timestamp: serverTimestamp()
                });
                messageInput.value = "";
            }
        };

        sendBtn.onclick = sendMessage;
        messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

        // 5. Réception des messages
        onChildAdded(chatRef, (snapshot) => {
            const val = snapshot.val();
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message';
            msgDiv.innerHTML = `<strong>${val.username}:</strong> ${val.text}`;
            chatBox.appendChild(msgDiv);
            chatBox.scrollTop = chatBox.scrollHeight;
        });

        console.log("BlabChat est connecté à Firebase !");

    } catch (error) {
        console.error("Erreur d'initialisation :", error);
    }
}

// Lancement
init();
