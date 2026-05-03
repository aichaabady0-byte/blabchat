const express = require('express');
const app = express();
const path = require('path');

app.use(express.static(__dirname));

// Cette route envoie tes clés API de Render vers ton navigateur en toute sécurité
app.get('/config', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BlabChat prêt sur le port ${PORT}`));
