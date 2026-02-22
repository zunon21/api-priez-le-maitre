const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

// ============================================
// IMPORTANT : Render fournit son propre PORT
// ============================================
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================
// CONFIGURATION DU FICHIER DE DONNÉES
// ============================================

const dataFile = path.join(__dirname, 'data.json');
const dataDir = path.dirname(dataFile);

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Dossier créé:', dataDir);
}

// Créer le fichier s'il n'existe pas
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ prayers: [] }, null, 2));
    console.log('📁 Fichier data.json créé automatiquement');
}

// ============================================
// FONCTIONS DE LECTURE/ÉCRITURE
// ============================================

function lireDonnees() {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        const parsed = JSON.parse(data);
        return parsed.prayers || [];
    } catch (error) {
        console.error('❌ Erreur lecture fichier:', error.message);
        fs.writeFileSync(dataFile, JSON.stringify({ prayers: [] }, null, 2));
        return [];
    }
}

function sauvegarderDonnees(prayers) {
    try {
        fs.writeFileSync(dataFile, JSON.stringify({ prayers }, null, 2));
        console.log('💾 Données sauvegardées');
        return true;
    } catch (error) {
        console.error('❌ Erreur sauvegarde:', error.message);
        return false;
    }
}

// ============================================
// ROUTES API
// ============================================

// Récupérer tous les sujets
app.get('/api/prayers', (req, res) => {
    try {
        const prayers = lireDonnees();
        console.log('📋 Récupération de tous les sujets - Total:', prayers.length);
        res.json(prayers);
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Récupérer le sujet du jour
app.get('/api/prayers/today', (req, res) => {
    try {
        const prayers = lireDonnees();
        const today = new Date().toISOString().split('T')[0];
        console.log('🔍 Recherche du sujet pour:', today);
        
        const todayPrayer = prayers.find(p => p.date === today);
        
        if (todayPrayer) {
            console.log('✅ Sujet trouvé:', todayPrayer.title);
            res.json(todayPrayer);
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
app.post('/api/prayers', (req, res) => {
    try {
        const prayers = lireDonnees();
        const newPrayer = req.body;
        
        if (!newPrayer.date || !newPrayer.title || !newPrayer.subject) {
            return res.status(400).json({ message: "Données incomplètes" });
        }
        
        console.log('➕ Ajout d\'un sujet:', newPrayer.date, '-', newPrayer.title);
        
        prayers.push(newPrayer);
        
        if (sauvegarderDonnees(prayers)) {
            res.status(201).json(newPrayer);
        } else {
            res.status(500).json({ message: "Erreur lors de la sauvegarde" });
        }
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Incrémenter le compteur de prières
app.post('/api/prayers/:date/pray', (req, res) => {
    try {
        const prayers = lireDonnees();
        const date = req.params.date;
        console.log('🙏 Prière enregistrée pour:', date);
        
        const prayerIndex = prayers.findIndex(p => p.date === date);
        
        if (prayerIndex !== -1) {
            prayers[prayerIndex].count = (prayers[prayerIndex].count || 0) + 1;
            
            if (sauvegarderDonnees(prayers)) {
                res.json({ count: prayers[prayerIndex].count });
            } else {
                res.status(500).json({ message: "Erreur lors de la sauvegarde" });
            }
        } else {
            res.status(404).json({ message: "Sujet non trouvé" });
        }
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// SUPPRIMER un sujet par sa date
app.delete('/api/prayers/:date', (req, res) => {
    try {
        const prayers = lireDonnees();
        const date = req.params.date;
        console.log('🗑️ Tentative de suppression pour la date:', date);
        
        const index = prayers.findIndex(p => p.date === date);
        
        if (index !== -1) {
            const deleted = prayers[index];
            prayers.splice(index, 1);
            
            if (sauvegarderDonnees(prayers)) {
                console.log('✅ Sujet supprimé avec succès:', deleted.title);
                res.status(200).json({ 
                    message: "Sujet supprimé avec succès",
                    deleted: deleted 
                });
            } else {
                res.status(500).json({ message: "Erreur lors de la sauvegarde" });
            }
        } else {
            console.log('❌ Sujet non trouvé pour la date:', date);
            res.status(404).json({ 
                message: "Sujet non trouvé",
                date: date 
            });
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
    console.log(`📁 Données sauvegardées dans: ${dataFile}`);
});