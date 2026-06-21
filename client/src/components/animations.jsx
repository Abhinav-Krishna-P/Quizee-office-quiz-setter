import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';

// 1. ShinyText - Shimmering gradient text effect
export function ShinyText({ text, disabled = false, speed = 2, className = '' }) {
  return (
    <span
      className={`inline-block text-transparent bg-clip-text bg-[linear-gradient(110deg,#eceff1,45%,#607d8b,55%,#eceff1)] bg-[length:200%_100%] ${
        disabled ? '' : 'animate-shimmer'
      } ${className}`}
      style={{
        animationDuration: `${speed}s`,
      }}
    >
      {text}
    </span>
  );
}

// 2. BlurText - Text letters that fade in and unblur
export function BlurText({ text, delay = 0.05, className = '' }) {
  const words = text.split(' ');
  
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: delay,
      },
    },
  };

  const childVariants = {
    hidden: { filter: 'blur(10px)', opacity: 0, y: 10 },
    visible: { filter: 'blur(0px)', opacity: 1, y: 0, transition: { type: 'spring', damping: 12, stiffness: 100 } },
  };

  return (
    <motion.span
      className={`inline-flex flex-wrap ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {words.map((word, wIdx) => (
        <span key={wIdx} className="inline-block mr-2 whitespace-nowrap">
          {word.split('').map((char, cIdx) => (
            <motion.span
              key={cIdx}
              className="inline-block"
              variants={childVariants}
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.span>
  );
}

// 3. SpotlightCard - Card with cursor spotlight radial gradient effect
export function SpotlightCard({ children, className = '', spotlightColor = 'rgba(255,255,255,0.07)' }) {
  const divRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseEnter = () => {
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition duration-300"
        style={{
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
          opacity,
        }}
      />
      {children}
    </div>
  );
}

// 4. CountUp - Counts up to a specific number
export function CountUp({ to, from = 0, duration = 1, className = '' }) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    let start = from;
    const end = to;
    if (start === end) return;

    const totalMiliseconds = duration * 1000;
    const incrementTime = Math.max(Math.floor(totalMiliseconds / (end - start)), 15);
    
    const timer = setInterval(() => {
      start += Math.ceil((end - from) / (totalMiliseconds / incrementTime));
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [to, from, duration]);

  return <span className={className}>{count}</span>;
}
