const express = require('express');
const app = express();
const path = require('path');

// TRÈS IMPORTANT : On dit à Express que les fichiers sont au même endroit que server.js
app.use(express.static(__dirname));

// Route pour envoyer les variables d'environnement de Render au navigateur
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

// Route par défaut qui sert l'index.html pour toutes les autres requêtes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Serveur BlabChat lancé sur le port ${PORT}`);
});
