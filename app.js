import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const chatRef = ref(db, 'messages');

const messageInput = document.getElementById('messageInput');
const usernameInput = document.getElementById('username');
const sendBtn = document.getElementById('sendBtn');
const chatBox = document.getElementById('chat-box');

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

onChildAdded(chatRef, (snapshot) => {
    const val = snapshot.val();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    msgDiv.innerHTML = `<strong>${val.username}:</strong> ${val.text}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
});
