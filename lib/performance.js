'use client';

import { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';

/**
 * Performance utilities for React components
 * Provides memoization helpers, debounce/throttle, and optimized hooks
 */

// Deep equality comparison for memoization
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

// Custom memo comparison for complex objects
export function createMemoComponent(Component, propsAreEqual = deepEqual) {
  return memo(Component, propsAreEqual);
}

// Shallow comparison for specific props
export function shallowEqualExcept(excludeKeys = []) {
  return (prevProps, nextProps) => {
    const prevKeys = Object.keys(prevProps).filter(k => !excludeKeys.includes(k));
    const nextKeys = Object.keys(nextProps).filter(k => !excludeKeys.includes(k));

    if (prevKeys.length !== nextKeys.length) return false;

    for (const key of prevKeys) {
      if (prevProps[key] !== nextProps[key]) return false;
    }

    return true;
  };
}

// Debounce hook
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Debounced callback hook
export function useDebouncedCallback(callback, delay) {
  const timeoutRef = useRef(null);

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

// Throttle hook
export function useThrottle(value, interval) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdated.current >= interval) {
      setThrottledValue(value);
      lastUpdated.current = now;
    } else {
      const timeout = setTimeout(() => {
        setThrottledValue(value);
        lastUpdated.current = Date.now();
      }, interval - (now - lastUpdated.current));

      return () => clearTimeout(timeout);
    }
  }, [value, interval]);

  return throttledValue;
}

// Throttled callback hook
export function useThrottledCallback(callback, interval) {
  const lastCall = useRef(0);
  const timeoutRef = useRef(null);

  return useCallback((...args) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall.current;

    if (timeSinceLastCall >= interval) {
      lastCall.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        lastCall.current = Date.now();
        callback(...args);
      }, interval - timeSinceLastCall);
    }
  }, [callback, interval]);
}

// Previous value hook
export function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

// Stable callback (never changes reference)
export function useStableCallback(callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args) => {
    return callbackRef.current(...args);
  }, []);
}

// Memoized object (deep comparison)
export function useMemoizedObject(obj) {
  const ref = useRef(obj);

  if (!deepEqual(ref.current, obj)) {
    ref.current = obj;
  }

  return ref.current;
}

// Lazy initialization hook
export function useLazyInit(initFn) {
  const ref = useRef(null);
  const initialized = useRef(false);

  if (!initialized.current) {
    ref.current = initFn();
    initialized.current = true;
  }

  return ref.current;
}

// Request animation frame throttle for smooth animations
export function useRafThrottle(callback) {
  const rafId = useRef(null);
  const latestArgs = useRef([]);

  const throttledCallback = useCallback((...args) => {
    latestArgs.current = args;

    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        callback(...latestArgs.current);
        rafId.current = null;
      });
    }
  }, [callback]);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return throttledCallback;
}

// Intersection observer hook for lazy loading
export function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const targetRef = useRef(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        root: options.root || null,
        rootMargin: options.rootMargin || '0px',
        threshold: options.threshold || 0,
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [options.root, options.rootMargin, options.threshold, hasIntersected]);

  return { targetRef, isIntersecting, hasIntersected };
}

// Window resize hook with debounce
export function useWindowSize(debounceMs = 100) {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, debounceMs);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [debounceMs]);

  return size;
}

// Stable identity for arrays (prevents re-renders when array contents are same)
export function useStableArray(array) {
  const ref = useRef(array);

  const isEqual = useMemo(() => {
    if (ref.current.length !== array.length) return false;
    return ref.current.every((item, i) => item === array[i]);
  }, [array]);

  if (!isEqual) {
    ref.current = array;
  }

  return ref.current;
}

// Batch state updates
export function useBatchedState(initialState) {
  const [state, setState] = useState(initialState);
  const pendingUpdates = useRef([]);
  const isScheduled = useRef(false);

  const batchedSetState = useCallback((update) => {
    pendingUpdates.current.push(update);

    if (!isScheduled.current) {
      isScheduled.current = true;

      requestAnimationFrame(() => {
        setState(prev => {
          let newState = prev;
          for (const update of pendingUpdates.current) {
            newState = typeof update === 'function' ? update(newState) : update;
          }
          pendingUpdates.current = [];
          isScheduled.current = false;
          return newState;
        });
      });
    }
  }, []);

  return [state, batchedSetState];
}

export default {
  deepEqual,
  createMemoComponent,
  shallowEqualExcept,
  useDebounce,
  useDebouncedCallback,
  useThrottle,
  useThrottledCallback,
  usePrevious,
  useStableCallback,
  useMemoizedObject,
  useLazyInit,
  useRafThrottle,
  useIntersectionObserver,
  useWindowSize,
  useStableArray,
  useBatchedState,
};
