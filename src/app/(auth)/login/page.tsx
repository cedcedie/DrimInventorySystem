"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { Box, ButtonBase, Typography, Alert } from "@mui/material";
import { ACCENT, ACCENT_HOVER } from "@/theme/tokens";
import { warmPostLogin } from "@/lib/warmPrefetch";

const TEXT = "#212B36";
const MUTED = "#646B72";
const LINE = "#E8E8E8";

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Typography component="label" sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
        {label} <Box component="span" sx={{ color: "#EF3826" }}>*</Box>
      </Typography>
      <Box
        component="input"
        type={type}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        sx={{
          border: `1px solid ${LINE}`,
          borderRadius: "8px",
          px: 1.5,
          py: "10px",
          fontSize: 14,
          fontFamily: "inherit",
          bgcolor: "#fff",
          color: TEXT,
          outline: "none",
          transition: "border-color 0.12s ease",
          "&:focus": { borderColor: ACCENT },
          "&::placeholder": { color: "#B5BBC1" },
        }}
      />
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    searchParams.get("expired") ? "Your session expired — please sign in again." : ""
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    if (result?.error) {
      setLoading(false);
      setError("Invalid username or password.");
      return;
    }
    await warmPostLogin(router, queryClient);
    router.refresh();
    router.push("/dashboard");
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex" }}>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          width: "50%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          px: 4,
          position: "relative",
          overflow: "hidden",
          bgcolor: "#0B0B0C",
          background: `
            radial-gradient(ellipse 90% 70% at 20% 15%, rgba(254,159,67,0.22), transparent 55%),
            radial-gradient(ellipse 70% 55% at 85% 85%, rgba(254,159,67,0.12), transparent 50%),
            linear-gradient(165deg, #121214 0%, #0B0B0C 45%, #1a1208 100%)
          `,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.35,
            backgroundImage: `
              linear-gradient(90deg, transparent 0%, transparent 48%, rgba(255,255,255,0.03) 49%, transparent 51%),
              linear-gradient(0deg, transparent 0%, transparent 48%, rgba(255,255,255,0.02) 49%, transparent 51%)
            `,
            backgroundSize: "80px 80px",
            pointerEvents: "none",
          }}
        />

        <Box
          component="img"
          src="/images/drim-logo-white-text-transparent.png"
          alt="DRIM Refrigeration Equipment Corp."
          sx={{ width: "76%", maxWidth: 480, height: "auto", position: "relative", zIndex: 1 }}
        />

        <Typography
          sx={{
            position: "relative",
            zIndex: 1,
            fontSize: { md: 18, lg: 22, xl: 24 },
            fontWeight: 800,
            fontStyle: "italic",
            color: "#fff",
            letterSpacing: "-0.2px",
            textAlign: "center",
            whiteSpace: "nowrap",
            lineHeight: 1.2,
            px: 1,
          }}
        >
          &ldquo;Your Refrigeration Solution Expert&rdquo;
        </Typography>

        <Typography
          sx={{
            position: "relative",
            zIndex: 1,
            fontSize: 13.5,
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            maxWidth: 380,
            lineHeight: 1.55,
          }}
        >
          Warehouse inventory, material requests, and field fulfillment — built for DRIM.
        </Typography>

        <Box
          sx={{
            position: "absolute",
            bottom: -24,
            left: -48,
            width: 280,
            height: 48,
            bgcolor: ACCENT,
            opacity: 0.9,
            transform: "skewY(-7deg)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: "22%",
            right: -70,
            width: 200,
            height: 36,
            bgcolor: "rgba(254,159,67,0.35)",
            transform: "skewY(8deg)",
          }}
        />
      </Box>

      <Box
        sx={{
          width: { xs: "100%", md: "50%" },
          bgcolor: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2.5, md: 6 },
          py: 4,
        }}
      >
        <Box component="form" onSubmit={handleSubmit} sx={{ width: 400, maxWidth: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 3.5 }}>
            <Box
              component="img"
              src="/images/drim-d-transparent.png"
              alt="DRIM"
              sx={{ width: 42, height: 42 }}
            />
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: TEXT }}>
              DRIM{" "}
              <Box component="span" sx={{ color: ACCENT }}>
                IMS
              </Box>
            </Typography>
          </Box>

          <Typography sx={{ fontSize: 24, fontWeight: 800, color: TEXT, mb: 0.5 }}>
            Sign In
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: MUTED, mb: 3, lineHeight: 1.5 }}>
            Enter your username and password to access the DRIM panel.
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Field label="Username" value={username} onChange={setUsername} placeholder="e.g. m.santos" />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />

            {error && (
              <Alert severity="error" sx={{ borderRadius: "8px", fontSize: 13 }}>
                {error}
              </Alert>
            )}

            <ButtonBase
              type="submit"
              disabled={loading}
              sx={{
                mt: 0.5,
                bgcolor: ACCENT,
                color: "#fff",
                borderRadius: "8px",
                py: "11px",
                fontSize: 14.5,
                fontWeight: 700,
                transition: "background-color 0.15s ease",
                "&:hover": { bgcolor: ACCENT_HOVER },
                "&.Mui-disabled": { opacity: 0.6 },
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </ButtonBase>
          </Box>

          <Typography sx={{ mt: 4, fontSize: 12.5, color: MUTED, textAlign: "center" }}>
            Copyright © {new Date().getFullYear()} — DRIM Refrigeration Equipment Corp.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
