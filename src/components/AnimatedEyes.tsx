import React, { useEffect, useState, useRef } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'motion/react';

export function AnimatedEyes({ size = 'large', isFocused = false, isSurprised: externalSurprised = false }: { size?: 'small' | 'large', isFocused?: boolean, isSurprised?: boolean }) {
  const isSmall = size === 'small';
  const [internalSurprised, setInternalSurprised] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);

  // Effective state is true if either internal or external surprise is active
  const isSurprised = internalSurprised || externalSurprised;

  // Mouse tracking values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for eye movement - Tighter when focused
  const springConfig = isFocused
    ? { damping: 15, stiffness: 250 }
    : { damping: 20, stiffness: 150 };
  const eyeX = useSpring(mouseX, springConfig);
  const eyeY = useSpring(mouseY, springConfig);

  // Map mouse position to narrow translation range within the "eye sockets"
  const range = isSmall ? 4 : 8;
  const translateX = useTransform(eyeX, [-window.innerWidth / 2, window.innerWidth / 2], [-range, range]);
  const translateY = useTransform(eyeY, [-window.innerHeight / 2, window.innerHeight / 2], [-(range * 0.6), range * 0.6]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate position relative to center of screen
      mouseX.set(e.clientX - window.innerWidth / 2);
      mouseY.set(e.clientY - window.innerHeight / 2);
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Idle animations loop - Disable when focused or externally surprised
    let timeoutId: NodeJS.Timeout;
    const runIdleAnimation = () => {
      if (isFocused || externalSurprised) return;

      const rand = Math.random();

      if (rand < 0.15) {
        // Surprise!
        setInternalSurprised(true);
        setTimeout(() => setInternalSurprised(false), 600);
        timeoutId = setTimeout(runIdleAnimation, 2000);
      } else if (rand < 0.4) {
        // Blink
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        timeoutId = setTimeout(runIdleAnimation, Math.random() * 4000 + 1000);
      } else {
        // Wait and try again
        timeoutId = setTimeout(runIdleAnimation, 1000);
      }
    };

    if (!isFocused && !externalSurprised) {
      timeoutId = setTimeout(runIdleAnimation, 2000);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeoutId);
    };
  }, [mouseX, mouseY, isFocused, externalSurprised]);

  // Blend between mouse-follow and focused leap
  const focusAmount = useMotionValue(0);
  const focusSpring = useSpring(focusAmount, { damping: 25, stiffness: 200 });

  useEffect(() => {
    focusAmount.set(isFocused ? 1 : 0);
  }, [isFocused, focusAmount]);

  const blendedX = useTransform(
    [translateX, focusSpring],
    ([tx, f]: any) => (1 - f) * tx + f * (range + 4)
  );
  const blendedY = useTransform(
    [translateY, focusSpring],
    ([ty, f]: any) => (1 - f) * ty + f * 2
  );

  return (
    <div className={`
      ${isSmall ? 'w-10 h-10 rounded-xl gap-1 mb-0' : 'w-24 h-24 rounded-[2rem] gap-3 mb-8'} 
      bg-white flex items-center justify-center shadow-xl border border-gray-100/50 shrink-0 transition-all duration-500
      ${isFocused ? '' : 'overflow-hidden'}
    `}>
      {/* Left Eye */}
      <motion.div
        animate={{
          scaleY: isBlinking ? 0.1 : (isSurprised ? 1.4 : 1),
          scaleX: isSurprised ? 1.2 : 1,
        }}
        style={{
          x: blendedX,
          y: blendedY,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25
        }}
        className={`
          ${isSmall ? 'w-1.5 h-2.5 rounded-[0.1rem]' : 'w-3.5 h-6 rounded-[0.25rem]'} 
          bg-[#61a0c2] shadow-[0_0_15px_rgba(79,70,229,0.25)]
        `}
      />
      {/* Right Eye */}
      <motion.div
        animate={{
          scaleY: isBlinking ? 0.1 : (isSurprised ? 1.4 : 1),
          scaleX: isSurprised ? 1.2 : 1,
        }}
        style={{
          x: blendedX,
          y: blendedY,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25
        }}
        className={`
          ${isSmall ? 'w-1.5 h-2.5 rounded-[0.1rem]' : 'w-3.5 h-6 rounded-[0.25rem]'} 
          bg-[#61a0c2] shadow-[0_0_15px_rgba(79,70,229,0.25)]
        `}
      />
    </div>
  );
}
