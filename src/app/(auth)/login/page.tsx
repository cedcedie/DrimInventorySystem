"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Box, ButtonBase, Typography, Alert } from "@mui/material";
import { CHROME_COLOR, ACCENT } from "@/theme/tokens";

const ROLE_OPTIONS = [
  { label: "Owner", demoUsername: "owner" },
  { label: "Admin", demoUsername: "admin" },
  { label: "Warehouse Staff", demoUsername: "warehouse" },
  { label: "Technician / Engineer", demoUsername: "technician" },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState(ROLE_OPTIONS[0]);
  const [username, setUsername] = useState(ROLE_OPTIONS[0].demoUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRolePick = (role: (typeof ROLE_OPTIONS)[number]) => {
    setSelectedRole(role);
    setUsername(role.demoUsername);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid username or password.");
      return;
    }
    router.push("/dashboard");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.1fr) minmax(420px,1fr)" },
      }}
    >
      <Box
        sx={{
          bgcolor: CHROME_COLOR,
          color: "#fff",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          p: 6,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              bgcolor: ACCENT,
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.5px",
            }}
          >
            DR
          </Box>
          <Box>
            <Box sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.5px" }}>DRIM</Box>
            <Box sx={{ fontSize: 11, color: "#93a1b0", letterSpacing: "0.4px" }}>
              INVENTORY SYSTEM
            </Box>
          </Box>
        </Box>

        <Box>
          <Typography sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2, maxWidth: 420 }}>
            One warehouse.
            <br />
            Four roles. Full trace.
          </Typography>
          <Typography sx={{ fontSize: "13.5px", color: "#93a1b0", mt: 1.5, maxWidth: 400, lineHeight: 1.55 }}>
            Every stock movement is tagged, referenced, and tied to the person who made it —
            from supplier delivery to technician MRF.
          </Typography>
        </Box>

        <Box sx={{ fontSize: 11, color: "#5d6c7b", letterSpacing: "0.4px" }}>
          DRIM ERP · REL 2.0 · WAREHOUSE MODULE
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#f5f6f7",
          px: 3,
          py: 6,
        }}
      >
        <Box component="form" onSubmit={handleSubmit} sx={{ width: 360, maxWidth: "100%" }}>
          <Typography sx={{ fontSize: 19, fontWeight: 700 }}>Log in</Typography>
          <Typography sx={{ fontSize: "12.5px", color: "#6b7684", my: 0.5, mb: 2.5 }}>
            Select your role, then log in. The role determines the modules and actions
            available.
          </Typography>

          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              color: "#8a93a0",
              mb: 1,
            }}
          >
            1 · Select role
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              mb: 2.25,
            }}
          >
            {ROLE_OPTIONS.map((role) => {
              const active = selectedRole.label === role.label;
              return (
                <ButtonBase
                  key={role.label}
                  onClick={() => handleRolePick(role)}
                  sx={{
                    border: "1px solid",
                    borderColor: active ? ACCENT : "#cdd2d8",
                    bgcolor: active ? ACCENT : "#fff",
                    color: active ? "#fff" : "#232a33",
                    borderRadius: "2px",
                    py: "9px",
                    px: 0.75,
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  {role.label}
                </ButtonBase>
              );
            })}
          </Box>

          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              color: "#8a93a0",
              mb: 1,
            }}
          >
            2 · Enter credentials
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.625 }}>
              <Typography component="label" sx={{ fontSize: "11.5px", fontWeight: 600, color: "#4b5563" }}>
                Username
              </Typography>
              <Box
                component="input"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                placeholder="e.g. m.santos"
                sx={{
                  border: "1px solid #cdd2d8",
                  borderRadius: "2px",
                  px: "11px",
                  py: "9px",
                  fontSize: 13,
                  bgcolor: "#fff",
                  fontFamily: "'Heebo', sans-serif",
                  outline: "none",
                  "&:focus": { borderColor: ACCENT },
                }}
              />
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.625 }}>
              <Typography component="label" sx={{ fontSize: "11.5px", fontWeight: 600, color: "#4b5563" }}>
                Password
              </Typography>
              <Box
                component="input"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="••••••••"
                sx={{
                  border: "1px solid #cdd2d8",
                  borderRadius: "2px",
                  px: "11px",
                  py: "9px",
                  fontSize: 13,
                  bgcolor: "#fff",
                  fontFamily: "'Heebo', sans-serif",
                  outline: "none",
                  "&:focus": { borderColor: ACCENT },
                }}
              />
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <ButtonBase
              type="submit"
              disabled={loading}
              sx={{
                mt: 0.5,
                bgcolor: ACCENT,
                color: "#fff",
                border: "none",
                borderRadius: "2px",
                py: "10px",
                fontSize: "13.5px",
                fontWeight: 600,
                letterSpacing: "0.2px",
                "&:hover": { filter: "brightness(1.12)" },
                "&.Mui-disabled": { opacity: 0.6 },
              }}
            >
              {loading ? "Logging in…" : `Log In as ${selectedRole.label}`}
            </ButtonBase>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
