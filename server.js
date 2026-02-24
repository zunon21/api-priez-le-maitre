const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================
// CONNEXION À MONGODB ATLAS
// ============================================

// 👇 REMPLACE PAR TA VRAIE CHAÎNE DE CONNEXION
const uri = "mongodb+srv://zunonserge10_db_user:JMtIPdocRXaMBmhj@cluster0.o5bnzzz.mongodb.net/priez-le-maitre?retryWrites=true&w=majority";
const client = new MongoClient(uri);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('priez-le-maitre');
        console.log('✅ Connecté à MongoDB Atlas');
    } catch (err) {
        console.error('❌ Erreur de connexion MongoDB :', err);
        process.exit(1);
    }
}
connectDB();

// ============================================
// ROUTES API (AVEC MONGODB)
// ============================================

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
            return res.status(400).json({ message: "Données incomplètes" });
        }
        
        console.log('➕ Ajout d\'un sujet:', newPrayer.date, '-', newPrayer.title);
        
        await db.collection('prayers').insertOne(newPrayer);
        res.status(201).json(newPrayer);
        
    } catch (error) {
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
        
        if (result.modifiedCount > 0) {
            const updated = await db.collection('prayers').findOne({ date });
            res.json({ count: updated.count });
        } else {
            res.status(404).json({ message: "Sujet non trouvé" });
        }
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

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API disponible sur le port ${PORT}`);
});