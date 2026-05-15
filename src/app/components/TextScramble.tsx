"use client";

import { useEffect, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;':,./<>?";

interface TextScrambleProps {
  text: string;
  duration?: number;
  delay?: number;
}

export default function TextScramble({ text, duration = 800, delay = 0 }: TextScrambleProps) {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    const timeoutId = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        let currentText = "";
        for (let i = 0; i < text.length; i++) {
          if (text[i] === " ") {
            currentText += " ";
            continue;
          }
          if (progress > i / text.length) {
            currentText += text[i];
          } else {
            currentText += CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        }
        
        setDisplayText(currentText);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        }
      };
      
      animationFrameId = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [text, duration, delay]);

  return <span>{displayText}</span>;
}
