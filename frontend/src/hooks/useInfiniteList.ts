"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** IntersectionObserver-driven incremental rendering for long lists.
 * Resets to one batch whenever the underlying list length changes. */
export function useInfiniteList(totalLength: number, batchSize: number) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = visibleCount < totalLength;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + batchSize, totalLength));
      setIsLoadingMore(false);
    }, 280);
  }, [hasMore, isLoadingMore, batchSize, totalLength]);

  useEffect(() => {
    setVisibleCount(Math.min(batchSize, totalLength));
    setIsLoadingMore(false);
  }, [batchSize, totalLength]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "280px 0px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const reset = useCallback(() => {
    setVisibleCount(batchSize);
  }, [batchSize]);

  return { visibleCount, isLoadingMore, sentinelRef, hasMore, loadMore, reset };
}
