// Sound Service using Web Audio API for synthetic sounds
// This ensures sound works immediately without needing external assets.

class SoundService {
    private context: AudioContext | null = null;
    private enabled: boolean = true;

    private getContext() {
        if (!this.context && typeof window !== 'undefined') {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                this.context = new AudioContext();
            }
        }
        return this.context;
    }

    private playTone(freq: number, type: OscillatorType, duration: number, delay: number = 0) {
        const ctx = this.getContext();
        if (!ctx || !this.enabled) return;

        // Resume context if suspended (browser policy)
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        const startTime = ctx.currentTime + delay;
        const stopTime = startTime + duration;

        osc.frequency.setValueAtTime(freq, startTime);
        
        // Louder initial volume and linear fade for punchier sound
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.linearRampToValueAtTime(0.01, stopTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(stopTime);
    }

    playSend() {
        // High pitch "pop"
        this.playTone(800, 'sine', 0.1);
    }

    playReceive() {
        // Two-tone "ding-dong"
        this.playTone(600, 'sine', 0.1);
        this.playTone(800, 'sine', 0.2, 0.1);
    }

    playWink() {
        // Sparkle effect (multiple rapid high tones)
        this.playTone(1200, 'triangle', 0.1, 0);
        this.playTone(1500, 'triangle', 0.1, 0.05);
        this.playTone(1800, 'triangle', 0.2, 0.1);
    }

    playNotification() {
        // Soft alert
        this.playTone(400, 'sine', 0.15);
    }

    playTyping() {
        // Very short, quiet click
        this.playTone(300, 'square', 0.03);
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }
}

export const soundService = new SoundService();