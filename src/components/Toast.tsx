"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import { lightTokens } from "@/theme/tokens";

export type ToastSeverity = "success" | "error";

const ToastContext = createContext<{
  showToast: (msg: string, severity?: ToastSeverity) => void;
}>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS: Record<ToastSeverity, number> = {
  // Errors stay up longer and don't auto-dismiss quite as eagerly — a
  // rejected mutation is more consequential than a confirmation, and on a
  // small phone screen a 2.6s window is easy to miss entirely.
  success: 2600,
  error: 6000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<ToastSeverity>("success");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string, sev: ToastSeverity = "success") => {
    setMessage(msg);
    setSeverity(sev);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(""), AUTO_DISMISS_MS[sev]);
  }, []);

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    setMessage("");
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <Box
          role="status"
          aria-live={severity === "error" ? "assertive" : "polite"}
          onClick={dismiss}
          sx={{
            position: "fixed",
            bottom: 22,
            right: 22,
            maxWidth: "min(420px, calc(100vw - 44px))",
            bgcolor: "#1f2a35",
            color: "#fff",
            px: 2,
            py: 1.375,
            fontSize: "12.5px",
            fontWeight: 600,
            lineHeight: 1.45,
            cursor: "pointer",
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            // The toast sits on a fixed dark surface in both modes, so this
            // uses the light-mode success/danger values directly rather than
            // the theme token, which would wash out against #1f2a35 in dark mode.
            borderLeft: `3px solid ${severity === "error" ? lightTokens.danger : lightTokens.success}`,
            boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            zIndex: 1400,
          }}
        >
          <Box component="span" sx={{ flex: 1 }}>
            {message}
          </Box>
          <Box component="span" sx={{ fontSize: 11, opacity: 0.6, flexShrink: 0, mt: 0.125 }}>
            ✕
          </Box>
        </Box>
      )}
    </ToastContext.Provider>
  );
}
