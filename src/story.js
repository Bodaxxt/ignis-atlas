/**
 * Ignis Atlas - Scroll Story
 * 5-beat scroll choreography using GSAP & ScrollTrigger.
 * Scrubs gravity uniform on the Hero Flame while stepping through the narrative.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initScrollStory(heroFlame) {
  const progressBar = document.getElementById('story-progress-bar');
  const beats = document.querySelectorAll('.story-beat');

  // Global scroll progress bar
  ScrollTrigger.create({
    trigger: '#story',
    start: 'top bottom',
    end: 'bottom bottom',
    onUpdate: (self) => {
      if (progressBar) {
        progressBar.style.width = `${(self.progress * 100).toFixed(1)}%`;
      }
    },
  });

  // Staggered reveal of each story beat with zero layout shift
  beats.forEach((beat, index) => {
    gsap.fromTo(
      beat,
      {
        opacity: 0.25,
        y: 35,
        scale: 0.98,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: beat,
          start: 'top 82%',
          end: 'top 45%',
          scrub: 0.5,
          toggleActions: 'play reverse play reverse',
        },
      }
    );
  });

  // Flame scrub choreography tied to story progression:
  // Beat 1: Start at Earth (1.0g)
  // Beat 2: Morph from 1.0g down to 0.0g (showing microgravity sphere)
  // Beat 3: Lunar habitat focus (0.16g)
  // Beat 4: Transition to zero-gravity informatics gap
  // Beat 5: Ready for screening tool
  if (heroFlame) {
    ScrollTrigger.create({
      trigger: '#story',
      start: 'top 80%',
      end: 'bottom 40%',
      scrub: 1.0,
      onUpdate: (self) => {
        const p = self.progress;
        let gValue;

        if (p < 0.25) {
          // Beat 1: 1.0g Earth
          gValue = 1.0 - (p / 0.25) * 0.3; // 1.0 -> 0.7
        } else if (p < 0.55) {
          // Beat 2: Drops to microgravity 0g
          const subP = (p - 0.25) / 0.3;
          gValue = 0.7 * (1 - subP); // 0.7 -> 0.0
        } else if (p < 0.8) {
          // Beat 3: Rises slightly to Lunar partial g (0.16g)
          const subP = (p - 0.55) / 0.25;
          gValue = 0.0 + subP * 0.16; // 0.0 -> 0.16
        } else {
          // Beat 4-5: Settle to 0.0g microgravity baseline
          const subP = (p - 0.8) / 0.2;
          gValue = 0.16 * (1 - subP); // 0.16 -> 0.0
        }

        heroFlame.setGravity(gValue);
      },
    });
  }

  // Smooth scroll button to Atlas view
  const jumpBtn = document.getElementById('btn-jump-atlas');
  if (jumpBtn) {
    jumpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('views-container');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

