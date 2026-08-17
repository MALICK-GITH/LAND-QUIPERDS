/**
 * Script pour générer des fichiers audio de test
 * Ce script utilise l'API Web Audio pour créer des sons basiques
 * et les exporte en fichiers WAV pour le développement
 */

const fs = require('fs');
const path = require('path');

// Fonction pour créer un WAV file manuellement
function createWavFile(frequency, duration, filename) {
  const sampleRate = 44100;
  const numSamples = sampleRate * duration;
  const buffer = Buffer.alloc(44 + numSamples * 2); // 44 bytes header + 16-bit samples
  
  // WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4); // File size
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
  buffer.writeUInt16LE(1, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40); // Subchunk2Size
  
  // Generate sine wave
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * frequency * t);
    const sample = Math.max(-1, Math.min(1, value)) * 32767;
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
  }
  
  return buffer;
}

// Générer les sons de base
const soundsDir = path.join(__dirname, '..', 'public', 'sounds', 'classic');

if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

console.log('Génération des sons de test...');

// Sons basiques
const soundConfigs = [
  { frequency: 880, duration: 0.15, filename: 'notification.mp3' },
  { frequency: 660, duration: 0.2, filename: 'challenge.mp3' },
  { frequency: 440, duration: 0.25, filename: 'duel.mp3' },
  { frequency: 1200, duration: 0.1, filename: 'message.mp3' },
  { frequency: 523, duration: 0.3, filename: 'win.mp3' },
  { frequency: 220, duration: 0.4, filename: 'loss.mp3' },
  { frequency: 2000, duration: 0.15, filename: 'deposit.mp3' },
  { frequency: 880, duration: 0.2, filename: 'withdrawal.mp3' },
];

soundConfigs.forEach(config => {
  const wavBuffer = createWavFile(config.frequency, config.duration, config.filename);
  const filepath = path.join(soundsDir, config.filename);
  fs.writeFileSync(filepath, wavBuffer);
  console.log(`✓ ${config.filename} généré`);
});

console.log('Sons générés avec succès dans', soundsDir);
console.log('Note: Ces sont des fichiers WAV basiques pour les tests.');
console.log('Pour la production, utilisez des fichiers MP3 de meilleure qualité.');