"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import { lightTokens } from "@/theme/tokens";

const ToastContext = createContext<{ showToast: (msg: string) => void }>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 2600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(""), AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: "fixed",
            bottom: 22,
            right: 22,
            bgcolor: "#1f2a35",
            color: "#fff",
            px: 2,
            py: 1.375,
            fontSize: "12.5px",
            fontWeight: 600,
            // The toast sits on a fixed dark surface in both modes, so this
            // uses the light-mode success value directly rather than the
            // theme token, which would wash out against #1f2a35 in dark mode.
            borderLeft: `3px solid ${lightTokens.success}`,
            boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            zIndex: 1400,
          }}
        >
          {message}
        </Box>
      )}
    </ToastContext.Provider>
  );
}
