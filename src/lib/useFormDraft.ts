"use client";

import { useEffect, useRef } from "react";

/**
 * Persists a form's in-progress state to localStorage so a dropped connection,
 * backgrounded tab, or accidental close doesn't destroy work in progress —
 * most relevant for technicians filing MRFs from job sites on unreliable
 * signal. Call `load()` once when the modal opens to restore a draft, and
 * `clear()` on successful submit. Writes are debounced and skipped while the
 * value is at its initial/empty shape so opening the modal doesn't itself
 * create a draft.
 */
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
        // localStorage unavailable (private browsing, quota) — draft persistence
        // is a nice-to-have, never block the form over it.
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
