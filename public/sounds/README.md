# Système de Sons SKILL2CASH

Ce dossier contient tous les fichiers audio pour les presets de sons personnalisables.

## 📁 Structure

```
sounds/
├── classic/          - Preset classique (sons sobres et professionnels)
├── cyberpunk/        - Preset cyberpunk (sons futuristes)
├── minimal/          - Preset minimal (sons discrets)
├── arcade/           - Preset arcade (sons style jeu vidéo)
├── retro/            - Preset rétro (sons 8-bit)
└── custom/           - Dossier pour les sons personnalisés des utilisateurs
```

## 🎵 Fichiers requis par preset

Chaque dossier de preset doit contenir ces 8 fichiers:

- `notification.mp3` - Son de notification générale
- `challenge.mp3` - Son pour nouveau défi
- `duel.mp3` - Son pour début de duel
- `message.mp3` - Son pour nouveau message
- `win.mp3` - Son pour victoire
- `loss.mp3` - Son pour défaite
- `deposit.mp3` - Son pour dépôt reçu
- `withdrawal.mp3` - Son pour retrait effectué

## 🔧 Génération de sons de test

Pour générer des sons basiques pour le développement:

```bash
node scripts/generate-sounds.js
```

Cela créera des fichiers WAV basiques dans le dossier `classic/`.

## 📥 Télécharger des sons professionnels

Pour la production, téléchargez des sons de haute qualité depuis:

- **Freesound.org** - https://freesound.org/
- **Zapsplat.com** - https://www.zapsplat.com/
- **Pixabay Audio** - https://pixabay.com/music/sound-effects/

### Recommandations techniques

- **Format**: MP3 (meilleure compatibilité)
- **Qualité**: 128kbps
- **Durée**: < 2 secondes
- **Volume**: Normalisé (-1dB)
- **Taille**: < 50KB par fichier

## 🎨 Créer vos propres presets

1. Créez un nouveau dossier dans `sounds/`
2. Ajoutez les 8 fichiers requis
3. Mettez à jour `src/lib/sounds.ts` pour inclure votre preset

## 🚀 Fallback automatique

Si les fichiers audio ne sont pas disponibles, le système utilise automatiquement des sons synthétiques générés par l'API Web Audio. Cela garantit que les sons fonctionnent même sans fichiers externes.

## 📝 Notes

- Les fichiers audio doivent être accessibles via HTTP depuis le navigateur
- Le système met en cache les sons après le premier chargement
- Les sons peuvent être superposés (plusieurs sons en même temps)
- Le volume est contrôlable par l'utilisateur dans les paramètres