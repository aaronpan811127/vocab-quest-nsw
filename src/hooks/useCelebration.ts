import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';

// Generate celebration sound using Web Audio API
const playSuccessSound = (isPerfect: boolean) => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const notes = isPerfect 
      ? [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6 - triumphant chord
      : [392.00, 493.88, 587.33]; // G4, B4, D5 - happy chord
    
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      
      // Stagger the notes for a pleasing arpeggio effect
      const startTime = audioContext.currentTime + (index * 0.1);
      const duration = isPerfect ? 0.4 : 0.3;
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    });

    // Add sparkle effect for perfect scores
    if (isPerfect) {
      setTimeout(() => {
        const sparkleFrequencies = [1318.51, 1567.98, 2093.00]; // E6, G6, C7
        sparkleFrequencies.forEach((freq, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioContext.currentTime);
          const start = audioContext.currentTime + (i * 0.08);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.15, start + 0.03);
          gain.gain.linearRampToValueAtTime(0, start + 0.2);
          osc.start(start);
          osc.stop(start + 0.2);
        });
      }, 500);
    }
  } catch (error) {
    // Audio not supported, fail silently
    console.log('Audio playback not supported');
  }
};

// Fire confetti burst for perfect scores
const fireCelebrationConfetti = () => {
  const duration = 3000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff'],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff'],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  // Initial big burst
  confetti({
    particleCount: 100,
    spread: 100,
    origin: { y: 0.6 },
    colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff'],
  });

  // Continuous side streams
  frame();
};

interface CelebrationOptions {
  score: number;
  totalQuestions: number;
  gameName?: string;
}

export const useCelebration = () => {
  const celebrate = useCallback(({ score, totalQuestions, gameName = 'Game' }: CelebrationOptions) => {
    const percentage = Math.round((score / totalQuestions) * 100);
    const isPerfect = percentage === 100;
    const isGreat = percentage >= 80;
    const isGood = percentage >= 60;

    // Play celebration sound
    playSuccessSound(isPerfect);

    // Fire confetti for perfect scores
    if (isPerfect) {
      fireCelebrationConfetti();
    }

    // Show congratulation toast
    if (isPerfect) {
      toast({
        title: "🏆 Perfect Score! 🏆",
        description: `Amazing! You got ${score}/${totalQuestions} correct in ${gameName}! You're a superstar! ⭐`,
        duration: 5000,
      });
    } else if (isGreat) {
      toast({
        title: "🎉 Fantastic Work! 🎉",
        description: `Great job! You scored ${percentage}% in ${gameName}! Keep it up! 🌟`,
        duration: 4000,
      });
    } else if (isGood) {
      toast({
        title: "👍 Good Effort! 👍",
        description: `You scored ${percentage}% in ${gameName}. Practice makes perfect! 💪`,
        duration: 4000,
      });
    } else {
      toast({
        title: "💪 Keep Practicing! 💪",
        description: `You scored ${percentage}% in ${gameName}. You'll do better next time! 🚀`,
        duration: 4000,
      });
    }
  }, []);

  return { celebrate };
};
