# Système de Sons Personnalisables - SKILL2CASH

Documentation complète du système de gestion des sons personnalisables pour les notifications et événements SKILL2CASH.

## 🎵 Vue d'ensemble

Le système de sons permet aux utilisateurs de personnaliser l'expérience audio de SKILL2CASH avec:
- **5 presets de sons** (Classique, Cyberpunk, Minimal, Arcade, Rétro)
- **Contrôle du volume** (0-100%)
- **Activation/désactivation** des sons
- **Mode personnalisé** pour utiliser ses propres fichiers audio
- **Fallback automatique** avec sons synthétiques si les fichiers manquent

## 🏗 Architecture

### Fichiers principaux

- `src/lib/sounds.ts` - Gestionnaire principal des sons
- `src/lib/sound-generator.ts` - Générateur de sons synthétiques (Web Audio API)
- `src/lib/toast-with-sound.ts` - Wrapper toast avec sons intégrés
- `src/hooks/use-sounds.ts` - Hook React pour la gestion des sons
- `src/hooks/use-push-notifications.ts` - Intégration sons dans les notifications

### Structure des dossiers

```
public/sounds/
├── classic/
│   ├── notification.mp3
│   ├── challenge.mp3
│   ├── duel.mp3
│   ├── message.mp3
│   ├── win.mp3
│   ├── loss.mp3
│   ├── deposit.mp3
│   └── withdrawal.mp3
├── cyberpunk/
│   └── (mêmes fichiers)
├── minimal/
│   └── (mêmes fichiers)
├── arcade/
│   └── (mêmes fichiers)
├── retro/
│   └── (mêmes fichiers)
└── custom/
    └── (fichiers personnalisés de l'utilisateur)
```

## 🎯 Types de sons

Chaque type d'événement a son propre son:

| Type | Description | Exemple d'utilisation |
|------|-------------|----------------------|
| `notification` | Notification générale | Alertes système |
| `challenge` | Nouveau défi | Quand quelqu'un vous défie |
| `duel` | Début de duel | Quand un duel commence |
| `message` | Nouveau message | Messages privés |
| `win` | Victoire | Quand vous gagnez un duel |
| `loss` | Défaite | Quand vous perdez un duel |
| `deposit` | Dépôt reçu | Quand un dépôt est validé |
| `withdrawal` | Retrait effectué | Quand un retrait est validé |

## 🎨 Presets disponibles

### Classic
Sons traditionnels, sobres et professionnels.

### Cyberpunk
Sons futuristes avec des éléments électroniques et synthétiques.

### Minimal
Sons discrets et épurés, parfaits pour une utilisation professionnelle.

### Arcade
Sons inspirés des jeux vidéo rétro, plus dynamiques.

### Rétro
Sons 8-bit style NES/Game Boy, pour une ambiance gaming.

### Custom
Permet à l'utilisateur d'utiliser ses propres fichiers audio.

## 🔧 Utilisation

### Dans les composants React

```tsx
import { useSounds } from "@/hooks/use-sounds";

function MyComponent() {
  const { settings, playSound, setVolume, setEnabled } = useSounds();
  
  const handleClick = () => {
    playSound("win"); // Joue le son de victoire
  };
  
  return (
    <div>
      <button onClick={handleClick}>Jouer son</button>
      <button onClick={() => setEnabled(!settings.enabled)}>
        {settings.enabled ? "Désactiver" : "Activer"} les sons
      </button>
    </div>
  );
}
```

### Avec les toasts

```tsx
import { toastWithSound } from "@/lib/toast-with-sound";

// Son de victoire automatique
toastWithSound.success("Félicitations ! Vous avez gagné !");

// Son de défaite automatique
toastWithSound.error("Dommage, vous avez perdu.");

// Son de message
toastWithSound.message("Nouveau message reçu !");
```

### Integration dans les notifications

Les sons sont automatiquement intégrés dans le système de notifications via `use-push-notifications.ts`. Le mapping est automatique selon le type de notification.

## 💾 Stockage des préférences

Les préférences utilisateur sont stockées dans `localStorage` sous la clé `skill2cash_sound_settings`:

```typescript
interface SoundSettings {
  enabled: boolean;           // Sons activés/désactivés
  volume: number;            // Volume 0-100
  preset: SoundPreset;       // Preset actuel
  customSounds: Partial<Record<SoundType, string>>; // Chemins personnalisés
}
```

## 🎛 Interface utilisateur

L'interface de configuration des sons est disponible dans la page **Profil** (`/profil`). Elle comprend:

- **Toggle principal** pour activer/désactiver les sons
- **Sélecteur de preset** pour choisir le thème sonore
- **Slider de volume** pour ajuster l'intensité
- **Boutons de prévisualisation** pour écouter chaque son
- **Bouton de réinitialisation** pour revenir aux paramètres par défaut
- **Mode personnalisé** avec instructions pour les fichiers personnalisés

## 🔊 Générateur de sons de secours

Si les fichiers audio ne sont pas disponibles, le système utilise automatiquement le générateur de sons synthétiques (`sound-generator.ts`) basé sur l'API Web Audio. Cela garantit que les sons fonctionnent même sans fichiers externes.

Les sons synthétiques incluent:
- Bips simples pour les notifications
- Accords pour victoires/défaites
- Effets sonores pour les événements spéciaux

## 📝 Ajouter de nouveaux presets

Pour ajouter un nouveau preset:

1. **Créer le dossier** dans `public/sounds/mon_preset/`
2. **Ajouter les 8 fichiers audio** requis
3. **Mettre à jour** `src/lib/sounds.ts`:

```typescript
export type SoundPreset = 
  | "classic" 
  | "cyberpunk" 
  | "minimal" 
  | "arcade" 
  | "retro" 
  | "custom"
  | "mon_preset"; // Nouveau preset

export const PRESET_LABELS: Record<SoundPreset, string> = {
  // ... autres presets
  mon_preset: "Mon Preset",
};

export const PRESET_SOUNDS: Record<SoundPreset, Record<SoundType, string>> = {
  // ... autres presets
  mon_preset: {
    notification: "/sounds/mon_preset/notification.mp3",
    challenge: "/sounds/mon_preset/challenge.mp3",
    // ... autres fichiers
  },
};
```

## 🎚 Recommandations audio

### Format
- **Format**: MP3 recommandé (compatibilité maximale)
- **Qualité**: 128kbps (bon compromis qualité/poids)
- **Durée**: < 2 secondes (sons courts et percutants)
- **Volume**: Normalisé pour éviter les différences de volume

### Sources de sons gratuits
- **Freesound.org** - Bibliothèque de sons sous licence Creative Commons
- **Zapsplat.com** - Effets sonores gratuits pour projets
- **Pixabay Audio** - Musique et effets sonores gratuits
- **OpenGameArt.org** - Sons pour jeux vidéo

### Création de sons personnalisés
Pour créer vos propres sons:
1. Utilisez un DAW (Audacity, FL Studio, Ableton)
2. Gardez les sons courts (< 2s)
3. Normalisez le volume
4. Exportez en MP3 128kbps
5. Placez-les dans `public/sounds/custom/`

## 🚀 Performances

- **Caching**: Les fichiers audio sont mis en cache après le premier chargement
- **Clonage**: Les sons sont clonés pour permettre la superposition
- **Cleanup**: Les instances audio sont nettoyées après lecture
- **Lazy loading**: Les sons ne sont chargés qu'à la première utilisation

## 🐛 Dépannage

### Les sons ne jouent pas
1. Vérifiez que les sons sont activés dans les paramètres
2. Vérifiez que le volume n'est pas à 0
3. Vérifiez que les fichiers audio existent dans les dossiers appropriés
4. Le système devrait utiliser le générateur de secours automatiquement

### Les sons sont trop forts/faibles
1. Ajustez le volume dans les paramètres du profil
2. Normalisez vos fichiers audio personnalisés

### Les sons ne chargent pas
1. Vérifiez les chemins des fichiers dans `PRESET_SOUNDS`
2. Vérifiez que les fichiers sont dans le dossier `public/sounds/`
3. Le générateur de secours devrait prendre le relais

## 📚 Exemples d'utilisation

### Exemple 1: Jouer un son spécifique

```tsx
import { playSound } from "@/lib/sounds";

function onChallengeReceived() {
  playSound("challenge");
}
```

### Exemple 2: Utiliser avec les notifications

```tsx
import { useSounds } from "@/hooks/use-sounds";

function NotificationSystem() {
  const { playSound } = useSounds();
  
  useEffect(() => {
    if (newNotification) {
      playSound("notification");
    }
  }, [newNotification]);
}
```

### Exemple 3: Son de victoire personnalisé

```tsx
import { toastWithSound } from "@/lib/toast-with-sound";

function onDuelWon() {
  toastWithSound.success("Victoire ! +500 FCFA");
}
```

## 🔮 Améliorations futures

- [ ] Support des fichiers WAV et OGG
- [ ] Éditeur de sons en ligne
- [ ] Téléchargement de presets communautaires
- [ ] Sons spatialisés (3D audio)
- [ ] Intégration avec les thèmes visuels
- [ ] API pour les développeurs tiers

## 📄 Licence

Les fichiers audio par défaut sont soumis aux licences de leurs sources respectives. Le code du système de sons est sous licence MIT.