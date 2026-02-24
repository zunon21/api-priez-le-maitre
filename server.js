const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================
// CONNEXION À MONGODB ATLAS (CORRIGÉE)
// ============================================

const uri = "mongodb+srv://zunonserge10_db_user:JMtIPdocRXaMBmhj@cluster0.o5bnzzz.mongodb.net/priez-le-maitre?retryWrites=true&w=majority";

// OPTIONS CORRIGÉES POUR RENDER
const client = new MongoClient(uri, {
    tls: true,
    tlsAllowInvalidCertificates: true,  // Essentiel pour Render
    tlsAllowInvalidHostnames: true,      // Essentiel pour Render
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    // autoSelectFamily: false,  // 👈 LIGNE SUPPRIMÉE (non supportée)
    retryWrites: true,
    retryReads: true
});

let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('priez-le-maitre');
        console.log('✅ Connecté à MongoDB Atlas');
        
        // Créer un index sur la date pour de meilleures performances
        await db.collection('prayers').createIndex({ date: 1 }, { unique: true });
        console.log('✅ Index créé sur le champ date');
        
    } catch (err) {
        console.error('❌ Erreur de connexion MongoDB :', err.message);
        console.log('🔄 Nouvelle tentative dans 5 secondes...');
        setTimeout(connectDB, 5000); // Réessaie après 5 secondes
    }
}

connectDB();

// ============================================
// ROUTE PRINCIPALE
// ============================================
app.get('/', (req, res) => {
    res.json({
        message: "Bienvenue sur l'API de Priez le Maître.",
        status: "API opérationnelle",
        mongodb: db ? "Connecté" : "En attente de connexion...",
        endpoints: [
            "/api - Informations de l'API",
            "/api/prayers - Liste de tous les sujets",
            "/api/prayers/today - Sujet du jour",
            "/api/prayers/:date/pray - Pour prier (POST)",
            "/api/prayers/:date - Pour supprimer (DELETE)"
        ]
    });
});

app.get('/api', (req, res) => {
    res.json({
        message: "Bienvenue sur l'API de Priez le Maître.",
        endpoints: [
            "/api/prayers - Liste de tous les sujets",
            "/api/prayers/today - Sujet du jour",
            "/api/prayers/:date/pray - Pour prier (POST)",
            "/api/prayers/:date - Pour supprimer (DELETE)"
        ]
    });
});

// ============================================
// ROUTES API
// ============================================

// Middleware pour vérifier la connexion MongoDB
app.use('/api/prayers', async (req, res, next) => {
    if (!db) {
        return res.status(503).json({ 
            message: "Base de données non disponible, tentative de reconnexion en cours..." 
        });
    }
    next();
});

// Récupérer tous les sujets
app.get('/api/prayers', async (req, res) => {
    try {
        const prayers = await db.collection('prayers').find().toArray();
        console.log('📋 Récupération de tous les sujets - Total:', prayers.length);
        res.json(prayers);
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Récupérer le sujet du jour
app.get('/api/prayers/today', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        console.log('🔍 Recherche du sujet pour:', today);
        
        const prayer = await db.collection('prayers').findOne({ date: today });
        
        if (prayer) {
            console.log('✅ Sujet trouvé:', prayer.title);
            res.json(prayer);
        } else {
            console.log('❌ Aucun sujet pour aujourd\'hui');
            res.status(404).json({ message: "Aucun sujet pour aujourd'hui" });
        }
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Ajouter un sujet
app.post('/api/prayers', async (req, res) => {
    try {
        const newPrayer = req.body;
        
        if (!newPrayer.date || !newPrayer.title || !newPrayer.subject) {
            return res.status(400).json({ message: "Données incomplètes. Requis: date, title, subject" });
        }
        
        // Ajouter un compteur à 0 si non fourni
        if (!newPrayer.count) newPrayer.count = 0;
        
        console.log('➕ Ajout d\'un sujet:', newPrayer.date, '-', newPrayer.title);
        
        await db.collection('prayers').insertOne(newPrayer);
        res.status(201).json({ 
            message: "Sujet ajouté avec succès",
            prayer: newPrayer 
        });
        
    } catch (error) {
        // Erreur de duplication (date déjà existante)
        if (error.code === 11000) {
            return res.status(400).json({ message: "Un sujet existe déjà pour cette date" });
        }
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Incrémenter le compteur de prières
app.post('/api/prayers/:date/pray', async (req, res) => {
    try {
        const date = req.params.date;
        console.log('🙏 Prière enregistrée pour:', date);
        
        const result = await db.collection('prayers').updateOne(
            { date },
            { $inc: { count: 1 } }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Sujet non trouvé pour cette date" });
        }
        
        const updated = await db.collection('prayers').findOne({ date });
        res.json({ 
            message: "Prière enregistrée",
            count: updated.count 
        });
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Supprimer un sujet
app.delete('/api/prayers/:date', async (req, res) => {
    try {
        const date = req.params.date;
        console.log('🗑️ Tentative de suppression pour la date:', date);
        
        const result = await db.collection('prayers').deleteOne({ date });
        
        if (result.deletedCount > 0) {
            console.log('✅ Sujet supprimé avec succès');
            res.status(200).json({ message: "Sujet supprimé avec succès" });
        } else {
            console.log('❌ Sujet non trouvé pour la date:', date);
            res.status(404).json({ message: "Sujet non trouvé", date });
        }
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Route pour vérifier l'état de santé de l'API
app.get('/health', (req, res) => {
    res.json({
        status: "OK",
        mongodb: db ? "connected" : "disconnected",
        timestamp: new Date().toISOString()
    });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API disponible sur le port ${PORT}`);
    console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', async () => {
    console.log('🛑 Arrêt du serveur...');
    await client.close();
    process.exit(0);
});