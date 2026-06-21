"use client";

import { useEffect, useState } from "react";

const PLACEHOLDERS = [
  "https://github.com/facebook/react",
  "https://github.com/vercel/next.js",
  "https://github.com/django/django",
  "https://github.com/golang/go",
  "https://github.com/rails/rails",
  "https://github.com/kubernetes/kubernetes"
];

/** Animated typewriter placeholder for the repo URL input. Pauses (and
 * clears) while the input is focused or has a value. */
export function useTypewriterPlaceholder(paused: boolean) {
  const [placeholderText, setPlaceholderText] = useState("");

  useEffect(() => {
    if (paused) {
      setPlaceholderText("");
      return;
    }
    let isMounted = true;
    let placeholderIndex = 0;
    let charIndex = 0;
    let typing = true;
    let timeoutId: NodeJS.Timeout;

    const tick = () => {
      if (!isMounted) return;
      const currentFullText = PLACEHOLDERS[placeholderIndex];
      if (typing) {
        setPlaceholderText(currentFullText.slice(0, charIndex + 1));
        charIndex++;
        if (charIndex >= currentFullText.length) {
          typing = false;
          timeoutId = setTimeout(tick, 2000); // Pause on complete string
        } else {
          timeoutId = setTimeout(tick, 45); // Typing speed
        }
      } else {
        setPlaceholderText(currentFullText.slice(0, charIndex - 1));
        charIndex--;
        if (charIndex <= 0) {
          typing = true;
          placeholderIndex = (placeholderIndex + 1) % PLACEHOLDERS.length;
          timeoutId = setTimeout(tick, 500); // Pause before next string
        } else {
          timeoutId = setTimeout(tick, 20); // Erasing speed
        }
      }
    };

    timeoutId = setTimeout(tick, 500);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [paused]);

  return placeholderText;
}
