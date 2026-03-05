import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'motion/react';

export function AnimatedEyes() {
  const controls = useAnimation();
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const animateEyes = async () => {
      // Randomly decide what to do next
      const action = Math.random();

      if (action < 0.6) {
        // Blink
        setIsBlinking(true);
        await controls.start({ scaleY: 0.1, transition: { duration: 0.1 } });
        await controls.start({ scaleY: 1, transition: { duration: 0.1 } });
        setIsBlinking(false);
        timeoutId = setTimeout(animateEyes, Math.random() * 3000 + 1000); // Wait 1-4s
      } else if (action < 0.8) {
        // Look left
        await controls.start({ x: -4, transition: { duration: 0.3, ease: 'easeInOut' } });
        timeoutId = setTimeout(async () => {
          await controls.start({ x: 0, transition: { duration: 0.3, ease: 'easeInOut' } });
          animateEyes();
        }, Math.random() * 2000 + 500);
      } else {
        // Look right
        await controls.start({ x: 4, transition: { duration: 0.3, ease: 'easeInOut' } });
        timeoutId = setTimeout(async () => {
          await controls.start({ x: 0, transition: { duration: 0.3, ease: 'easeInOut' } });
          animateEyes();
        }, Math.random() * 2000 + 500);
      }
    };

    // Start the animation loop after a short delay
    timeoutId = setTimeout(animateEyes, 1000);

    return () => clearTimeout(timeoutId);
  }, [controls]);

  return (
    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center gap-2 mb-5 shadow-sm border border-gray-200">
      <motion.div
        animate={controls}
        className="w-2.5 h-4 bg-indigo-600 rounded-sm"
        style={{ originY: 0.5 }}
      />
      <motion.div
        animate={controls}
        className="w-2.5 h-4 bg-indigo-600 rounded-sm"
        style={{ originY: 0.5 }}
      />
    </div>
  );
}
