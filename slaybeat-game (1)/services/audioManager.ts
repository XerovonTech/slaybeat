
class AudioManager {
  private static instance: AudioManager;
  private currentMusic: HTMLAudioElement | null = null;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;

  private constructor() {}

  static getInstance() {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  setSettings(music: boolean, sound: boolean) {
    this.musicEnabled = music;
    this.soundEnabled = sound;
    if (!music && this.currentMusic) {
      this.currentMusic.pause();
    }
  }

  playMusic(url: string, loop: boolean = true, volume: number = 0.5) {
    if (!this.musicEnabled) return;
    
    // Stop previous music immediately
    this.stopMusic();

    this.currentMusic = new Audio(url);
    this.currentMusic.loop = loop;
    this.currentMusic.volume = volume;
    this.currentMusic.play().catch(e => console.warn("Music playback failed:", e));
  }

  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
      this.currentMusic = null;
    }
  }

  playSound(url: string, volume: number = 0.6) {
    if (!this.soundEnabled) return;
    const sfx = new Audio(url);
    sfx.volume = volume;
    sfx.play().catch(e => console.warn("SFX playback failed:", e));
  }

  pauseMusic() {
    if (this.currentMusic) this.currentMusic.pause();
  }

  resumeMusic() {
    if (this.currentMusic && this.musicEnabled) this.currentMusic.play().catch(() => {});
  }
}

export const audioManager = AudioManager.getInstance();
