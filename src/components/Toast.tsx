"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Snackbar, Alert } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
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
  // Errors stay up longer — more consequential than a confirmation.
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
      <Snackbar
        open={Boolean(message)}
        autoHideDuration={AUTO_DISMISS_MS[severity]}
        onClose={(_, reason) => {
          // Only the built-in timeout or an explicit close counts — a stray click
          // elsewhere on the page shouldn't dismiss a toast the user hasn't seen yet.
          if (reason !== "clickaway") dismiss();
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        sx={{ zIndex: 1400 }}
      >
        <Alert
          onClose={dismiss}
          onClick={dismiss}
          severity={severity}
          variant="filled"
          icon={
            severity === "error" ? (
              <ErrorOutlineIcon fontSize="inherit" sx={{ color: lightTokens.danger }} />
            ) : (
              <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: lightTokens.success }} />
            )
          }
          sx={{
            maxWidth: "min(420px, calc(100vw - 44px))",
            // Fixed dark surface in both modes, so uses light-mode tokens directly (dark tokens would wash out).
            bgcolor: "#1f2a35",
            color: "#fff",
            fontSize: "12.5px",
            fontWeight: 600,
            lineHeight: 1.45,
            cursor: "pointer",
            boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            "& .MuiAlert-action": { color: "#fff", opacity: 0.6 },
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
