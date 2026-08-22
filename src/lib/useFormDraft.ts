"use client";

import { useEffect, useRef } from "react";

/** Persists in-progress form state to localStorage (dropped connection, backgrounded tab, etc.) —
 * most relevant for technicians filing MRFs on unreliable signal. Call `load()` on modal open,
 * `clear()` on successful submit. Debounced; skipped while empty so opening the modal doesn't
 * itself create a draft. */
export function useFormDraft<T>(key: string, value: T, isEmpty: (v: T) => boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        if (isEmpty(value)) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(value));
        }
      } catch {
        // localStorage unavailable — draft persistence is a nice-to-have, never block the form.
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, JSON.stringify(value)]);

  return {
    load(): T | null {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}
