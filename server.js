const express = require('express');
const app = express();
const path = require('path');

// 1. D'abord, on sert les fichiers statiques (app.js, style.css)
// On utilise path.resolve pour être sûr du chemin sur Render
app.use(express.static(path.resolve(__dirname)));

// 2. Ta route de configuration
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

// 3. EN DERNIER : On ne sert l'index.html QUE si ce n'est pas un fichier
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});
