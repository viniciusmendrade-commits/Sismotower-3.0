let audioContext: AudioContext | null = null;
let isMuted = false;

const initAudioContext = () => {
  if (!audioContext && typeof window !== 'undefined') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
};

export const toggleMute = (): boolean => {
  initAudioContext();
  isMuted = !isMuted;
  return isMuted;
};

export const getIsMuted = (): boolean => {
  return isMuted;
};

const play = (params: {
  type: OscillatorType;
  frequency?: number;
  volume?: number;
  duration: number;
  attack?: number;
  frequencyEnd?: number;
}) => {
  initAudioContext();
  if (isMuted || !audioContext) return;
  
  const { 
    type, 
    frequency = 440, 
    volume = 0.3, 
    duration, 
    attack = 0.01, 
    frequencyEnd = frequency
  } = params;

  const gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);

  const oscillator = audioContext.createOscillator();
  oscillator.type = type;
  oscillator.connect(gainNode);

  const now = audioContext.currentTime;
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume, now + attack);
  gainNode.gain.linearRampToValueAtTime(0, now + duration);
  
  oscillator.frequency.setValueAtTime(frequency, now);
  if (frequency !== frequencyEnd) {
      oscillator.frequency.linearRampToValueAtTime(frequencyEnd, now + duration * 0.8);
  }

  oscillator.start(now);
  oscillator.stop(now + duration);
};

const playNoise = (params: {
  volume?: number;
  duration: number;
  attack?: number;
  filterFrequency?: number;
  filterQ?: number;
}) => {
    initAudioContext();
    if (isMuted || !audioContext) return;

    const { volume = 0.2, duration, attack = 0.01, filterFrequency = 800, filterQ = 1 } = params;

    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFrequency;
    filter.Q.value = filterQ;

    const gainNode = audioContext.createGain();
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + attack);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    noise.start(now);
    noise.stop(now + duration);
}

// Specific sounds
export const playClick = () => play({ type: 'triangle', frequency: 800, duration: 0.1, volume: 0.2 });
export const playMaterialChange = () => play({ type: 'sine', frequency: 600, frequencyEnd: 900, duration: 0.1, volume: 0.3 });
export const playReset = () => play({ type: 'sawtooth', frequency: 200, frequencyEnd: 1200, duration: 0.5, volume: 0.3 });
export const playDamage = () => playNoise({ duration: 0.2, volume: 0.4, filterFrequency: 200, filterQ: 2 });
export const playSimulationStart = () => {
    play({ type: 'sawtooth', frequency: 500, frequencyEnd: 700, duration: 0.3, volume: 0.4 });
    setTimeout(() => play({ type: 'sawtooth', frequency: 500, frequencyEnd: 700, duration: 0.3, volume: 0.4 }), 400);
};

// Disaster sounds
export const playEarthquakeSound = () => {
    if (isMuted || !audioContext) return;
    const interval = setInterval(() => playNoise({ duration: 0.3, volume: 0.5, filterFrequency: 100, filterQ: 1 }), 200);
    setTimeout(() => clearInterval(interval), 1800);
};
export const playTsunamiSound = () => playNoise({ duration: 2.0, volume: 0.6, filterFrequency: 400, filterQ: 1 });
export const playHurricaneSound = () => playNoise({ duration: 2.0, volume: 0.5, filterFrequency: 1000, filterQ: 2 });
export const playLightningSound = () => {
    setTimeout(() => playNoise({ duration: 0.2, volume: 0.7, filterFrequency: 4000, filterQ: 1 }), 880); // Corresponds to lightning-strike animation
};

// Result sounds
export const playResultSound = (health: number) => {
    if (health > 75) { // Good
        play({ type: 'sine', frequency: 523, duration: 0.15, volume: 0.4 });
        setTimeout(() => play({ type: 'sine', frequency: 659, duration: 0.15, volume: 0.4 }), 150);
        setTimeout(() => play({ type: 'sine', frequency: 783, duration: 0.2, volume: 0.4 }), 300);
    } else if (health > 35) { // Medium / Bad
        play({ type: 'square', frequency: 440, frequencyEnd: 340, duration: 0.6, volume: 0.3 });
    } else { // Collapse
        playNoise({ duration: 1.5, volume: 0.8, filterFrequency: 150, filterQ: 0.5 });
        play({ type: 'sawtooth', frequency: 200, frequencyEnd: 50, duration: 1.5, volume: 0.5 });
    }
};