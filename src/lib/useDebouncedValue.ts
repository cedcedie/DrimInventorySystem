"use client";

import { useEffect, useState } from "react";

/** Returns `value`, but delayed until it's stopped changing for `delayMs`.
 * For a search box wired straight to a server fetch — the input itself stays
 * instant (it's just local state), but the network request only fires once
 * typing pauses, instead of once per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
