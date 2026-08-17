/**
 * Système de gestion des sons personnalisables pour SKILL2CASH
 */

import { getSoundGenerator } from "./sound-generator";

export type SoundType = 
  | "notification" 
  | "challenge" 
  | "duel" 
  | "message" 
  | "win" 
  | "loss" 
  | "deposit" 
  | "withdrawal";

export type SoundPreset = 
  | "classic" 
  | "cyberpunk" 
  | "minimal" 
  | "arcade" 
  | "retro" 
  | "custom";

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0-100
  preset: SoundPreset;
  customSounds: Partial<Record<SoundType, string>>;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 70,
  preset: "classic",
  customSounds: {},
};

export const SOUND_LABELS: Record<SoundType, string> = {
  notification: "Notification générale",
  challenge: "Nouveau défi",
  duel: "Duel commencé",
  message: "Nouveau message",
  win: "Victoire",
  loss: "Défaite",
  deposit: "Dépôt reçu",
  withdrawal: "Retrait effectué",
};

export const PRESET_LABELS: Record<SoundPreset, string> = {
  classic: "Classique",
  cyberpunk: "Cyberpunk",
  minimal: "Minimal",
  arcade: "Arcade",
  retro: "Rétro",
  custom: "Personnalisé",
};

// Mapping des sons par défaut pour chaque preset
export const PRESET_SOUNDS: Record<SoundPreset, Record<SoundType, string>> = {
  classic: {
    notification: "/sounds/classic/notification.wav",
    challenge: "/sounds/classic/challenge.wav",
    duel: "/sounds/classic/duel.wav",
    message: "/sounds/classic/message.wav",
    win: "/sounds/classic/win.wav",
    loss: "/sounds/classic/loss.wav",
    deposit: "/sounds/classic/win.wav",
    withdrawal: "/sounds/classic/win.wav",
  },
  cyberpunk: {
    notification: "/sounds/cyberpunk/notification.mp3",
    challenge: "/sounds/cyberpunk/challenge.mp3",
    duel: "/sounds/cyberpunk/duel.mp3",
    message: "/sounds/cyberpunk/message.mp3",
    win: "/sounds/cyberpunk/win.mp3",
    loss: "/sounds/cyberpunk/loss.mp3",
    deposit: "/sounds/cyberpunk/deposit.mp3",
    withdrawal: "/sounds/cyberpunk/withdrawal.mp3",
  },
  minimal: {
    notification: "/sounds/minimal/notification.mp3",
    challenge: "/sounds/minimal/challenge.mp3",
    duel: "/sounds/minimal/duel.mp3",
    message: "/sounds/minimal/message.mp3",
    win: "/sounds/minimal/win.mp3",
    loss: "/sounds/minimal/loss.mp3",
    deposit: "/sounds/minimal/deposit.mp3",
    withdrawal: "/sounds/minimal/withdrawal.mp3",
  },
  arcade: {
    notification: "/sounds/arcade/notification.mp3",
    challenge: "/sounds/arcade/challenge.mp3",
    duel: "/sounds/arcade/duel.mp3",
    message: "/sounds/arcade/message.mp3",
    win: "/sounds/arcade/win.mp3",
    loss: "/sounds/arcade/loss.mp3",
    deposit: "/sounds/arcade/deposit.mp3",
    withdrawal: "/sounds/arcade/withdrawal.mp3",
  },
  retro: {
    notification: "/sounds/retro/notification.mp3",
    challenge: "/sounds/retro/challenge.mp3",
    duel: "/sounds/retro/duel.mp3",
    message: "/sounds/retro/message.mp3",
    win: "/sounds/retro/win.mp3",
    loss: "/sounds/retro/loss.mp3",
    deposit: "/sounds/retro/deposit.mp3",
    withdrawal: "/sounds/retro/withdrawal.mp3",
  },
  custom: {
    notification: "",
    challenge: "",
    duel: "",
    message: "",
    win: "",
    loss: "",
    deposit: "",
    withdrawal: "",
  },
};

class SoundManager {
  private audioContext: AudioContext | null = null;
  private settings: SoundSettings = DEFAULT_SOUND_SETTINGS;
  private cache: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    this.loadSettings();
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem("skill2cash_sound_settings");
      if (saved) {
        this.settings = { ...DEFAULT_SOUND_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Erreur lors du chargement des paramètres son:", e);
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem("skill2cash_sound_settings", JSON.stringify(this.settings));
    } catch (e) {
      console.error("Erreur lors de la sauvegarde des paramètres son:", e);
    }
  }

  getSettings(): SoundSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  getSoundPath(type: SoundType): string {
    if (this.settings.preset === "custom") {
      return this.settings.customSounds[type] || "";
    }
    return PRESET_SOUNDS[this.settings.preset][type] || "";
  }

  async play(type: SoundType): Promise<void> {
    if (!this.settings.enabled || this.settings.volume === 0) {
      return;
    }

    const soundPath = this.getSoundPath(type);
    
    try {
      let audio = this.cache.get(soundPath);
      
      if (!audio && soundPath) {
        audio = new Audio(soundPath);
        audio.volume = this.settings.volume / 100;
        this.cache.set(soundPath, audio);
      } else if (audio) {
        audio.volume = this.settings.volume / 100;
      }

      if (audio && soundPath) {
        // Resume audio context if suspended (required by some browsers)
        const ctx = this.getAudioContext();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        // Clone audio to allow overlapping sounds
        const clone = audio.cloneNode() as HTMLAudioElement;
        clone.volume = this.settings.volume / 100;
        await clone.play();
        
        // Clean up after playing
        clone.onended = () => {
          clone.remove();
        };
      } else {
        // Fallback to sound generator if no audio file available
        const generator = getSoundGenerator();
        const generatorMethod = type as keyof typeof generator;
        if (typeof generator[generatorMethod] === 'function') {
          await (generator[generatorMethod] as () => Promise<void>)();
        }
      }
    } catch (e) {
      console.error("Erreur lors de la lecture du son:", e);
      // Fallback to sound generator on error
      try {
        const generator = getSoundGenerator();
        const generatorMethod = type as keyof typeof generator;
        if (typeof generator[generatorMethod] === 'function') {
          await (generator[generatorMethod] as () => Promise<void>)();
        }
      } catch (fallbackError) {
        console.error("Erreur lors du fallback son:", fallbackError);
      }
    }
  }

  async preview(type: SoundType): Promise<void> {
    await this.play(type);
  }

  reset() {
    this.settings = { ...DEFAULT_SOUND_SETTINGS };
    this.saveSettings();
    this.cache.clear();
  }
}

// Singleton instance
let soundManagerInstance: SoundManager | null = null;

export function getSoundManager(): SoundManager {
  if (!soundManagerInstance) {
    soundManagerInstance = new SoundManager();
  }
  return soundManagerInstance;
}

// Fonction helper pour jouer un son facilement
export function playSound(type: SoundType): void {
  const manager = getSoundManager();
  void manager.play(type);
}