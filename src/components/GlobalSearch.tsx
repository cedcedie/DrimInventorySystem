"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, motion } from "@/theme/tokens";
import { fetchJson } from "@/lib/api";

interface SearchHit {
  type: "product" | "mrf" | "slip";
  id: string;
  label: string;
  meta: string;
  href: string;
}

export function GlobalSearch() {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const data = await fetchJson<{ results: SearchHit[] }>(
            `/api/search?q=${encodeURIComponent(q.trim())}`
          );
          setResults(data.results);
          setOpen(true);
        } catch {
          setResults([]);
        }
      });
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <Box ref={wrapRef} sx={{ position: "relative", display: { xs: "none", sm: "block" } }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          width: 340,
          maxWidth: "38vw",
          height: 38,
          px: 1.5,
          borderRadius: "8px",
          border: "1px solid",
          borderColor: open ? ACCENT : t.line,
          bgcolor: t.surface2,
          transition: `border-color ${motion.duration.color}ms ${motion.easing.standard}`,
        }}
      >
        <SearchIcon sx={{ fontSize: 18, color: t.muted2 }} />
        <Box
          component="input"
          value={q}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search products, MRF, slip no..."
          sx={{
            border: "none",
            outline: "none",
            bgcolor: "transparent",
            fontSize: 13.5,
            fontFamily: "inherit",
            color: t.text,
            width: "100%",
            "&::placeholder": { color: t.muted2 },
          }}
        />
        {pending && (
          <Typography sx={{ fontSize: 11, color: t.muted2, flexShrink: 0 }}>…</Typography>
        )}
      </Box>

      {open && (
        <Box
          sx={{
            position: "absolute",
            top: 44,
            left: 0,
            width: "100%",
            minWidth: 320,
            bgcolor: t.surface,
            border: "1px solid",
            borderColor: t.line,
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(16,24,40,0.10)",
            zIndex: 1300,
            overflow: "hidden",
          }}
        >
          {results.length === 0 ? (
            <Box sx={{ px: 2, py: 2, fontSize: 13, color: t.muted }}>No matches for “{q}”</Box>
          ) : (
            results.map((r) => (
              <Box
                key={`${r.type}-${r.id}`}
                onClick={() => {
                  setOpen(false);
                  setQ("");
                  router.push(r.href);
                }}
                sx={{
                  px: 2,
                  py: 1.25,
                  cursor: "pointer",
                  borderBottom: "1px solid",
                  borderColor: t.line2,
                  "&:hover": { bgcolor: t.hover },
                  "&:last-child": { borderBottom: "none" },
                }}
              >
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>
                  {r.label}
                </Typography>
                <Typography sx={{ fontSize: 12, color: t.muted }}>
                  {r.type.toUpperCase()} · {r.meta}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  );
}
