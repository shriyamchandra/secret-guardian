"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAVIGATION_TIMEOUT_MS = 900;
const NAVIGATION_SETTLE_MS = 140;

const isModifiedClick = (event: MouseEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

export function NavigationTransitionLayer() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearNavigationTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (isModifiedClick(event)) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");

      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      const currentPath = `${currentUrl.pathname}${currentUrl.search}`;

      if (nextUrl.origin !== currentUrl.origin || nextPath === currentPath) {
        return;
      }

      clearNavigationTimer();
      setIsNavigating(true);
      timeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
        timeoutRef.current = null;
      }, NAVIGATION_TIMEOUT_MS);
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      clearNavigationTimer();
    };
  }, []);

  useEffect(() => {
    if (!isNavigating) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const settleTimer = setTimeout(() => {
      setIsNavigating(false);
    }, NAVIGATION_SETTLE_MS);

    return () => clearTimeout(settleTimer);
  }, [pathname, isNavigating]);

  return (
    <div
      aria-hidden="true"
      className={`nav-transition-layer ${isNavigating ? "is-active" : ""}`}
    >
      <div className="nav-transition-progress" />
      <div className="nav-transition-sweep" />
      <div className="nav-transition-vignette" />
    </div>
  );
}
