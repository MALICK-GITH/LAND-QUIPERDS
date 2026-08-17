/**
 * Générateur de sons synthétiques pour les tests et le développement
 * Utilise l'API Web Audio pour créer des sons sans fichiers externes
 */

export class SoundGenerator {
  private audioContext: AudioContext;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  private async ensureContext() {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  /**
   * Génère un bip simple
   */
  async beep(frequency: number = 440, duration: number = 0.1, volume: number = 0.3): Promise<void> {
    await this.ensureContext();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  /**
   * Son de notification (bip court)
   */
  async notification(): Promise<void> {
    await this.beep(880, 0.15, 0.2);
  }

  /**
   * Son de défi (montée)
   */
  async challenge(): Promise<void> {
    await this.ensureContext();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.2);
    oscillator.type = "square";
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }

  /**
   * Son de duel (démarrage)
   */
  async duel(): Promise<void> {
    await this.ensureContext();
    
    // Premier son
    await this.beep(660, 0.1, 0.25);
    await new Promise(resolve => setTimeout(resolve, 100));
    // Deuxième son
    await this.beep(880, 0.15, 0.3);
  }

  /**
   * Son de message (pop)
   */
  async message(): Promise<void> {
    await this.ensureContext();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = 1200;
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.08);
  }

  /**
   * Son de victoire (accord ascendant)
   */
  async win(): Promise<void> {
    await this.ensureContext();
    
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    for (let i = 0; i < notes.length; i++) {
      await this.beep(notes[i], 0.1, 0.2);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Son de défaite (accord descendant)
   */
  async loss(): Promise<void> {
    await this.ensureContext();
    
    const notes = [523.25, 493.88, 440.00, 392.00]; // C5, B4, A4, G4
    for (let i = 0; i < notes.length; i++) {
      await this.beep(notes[i], 0.15, 0.2);
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }

  /**
   * Son de dépôt (monnaie)
   */
  async deposit(): Promise<void> {
    await this.ensureContext();
    
    // Son de pièces
    for (let i = 0; i < 3; i++) {
      await this.beep(2000 + Math.random() * 500, 0.05, 0.15);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Son de retrait (validation)
   */
  async withdrawal(): Promise<void> {
    await this.ensureContext();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.3);
    oscillator.type = "triangle";
    
    gainNode.gain.setValueAtTime(0.25, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }
}

// Singleton instance
let soundGeneratorInstance: SoundGenerator | null = null;

export function getSoundGenerator(): SoundGenerator {
  if (!soundGeneratorInstance) {
    soundGeneratorInstance = new SoundGenerator();
  }
  return soundGeneratorInstance;
}