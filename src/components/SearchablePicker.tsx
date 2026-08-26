"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

const RESULT_CAP = 8;

/**
 * Generic search-filtered dropdown, replacing a raw `<Select>` for lists that
 * can grow past a screenful (products, suppliers, MRF line items). Typing
 * narrows by whatever `matches` checks; closed/empty-query view shows the
 * "recent" items first (if given), then the rest capped at RESULT_CAP.
 *
 * Same interaction model as ItemCartEditor's product picker (search-first,
 * not every option mounted) — factored out here so modals that only need a
 * single selection (not a running cart) don't hand-roll their own copy.
 */
export function SearchablePicker<T>({
  value,
  onChange,
  options,
  recent,
  matches,
  renderOption,
  renderLabel,
  getKey,
  placeholder,
  emptyMessage = "No matches.",
  loadingMessage = "Loading…",
}: {
  /** Currently selected item's id, or "" for none. */
  value: string;
  onChange: (item: T) => void;
  options: T[] | undefined;
  /** Up to a few recently-used items, shown above the full list when the
   * search box is empty. Omit if there's no meaningful "recent" for this picker. */
  recent?: T[];
  matches: (item: T, needle: string) => boolean;
  renderOption: (item: T) => React.ReactNode;
  /** Text shown in the input once an item is picked. */
  renderLabel: (item: T) => string;
  getKey: (item: T) => string;
  placeholder: string;
  emptyMessage?: string;
  loadingMessage?: string;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Once a value is picked, show its label in the box instead of the raw query.
  useEffect(() => {
    if (!value || !options) return;
    const picked = options.find((o) => getKey(o) === value);
    if (picked) setQuery(renderLabel(picked));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the picked value itself changes, not on every render
  }, [value]);

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !options) return null;
    return options.filter((o) => matches(o, needle)).slice(0, RESULT_CAP);
  }, [options, query, matches]);

  const recentIds = new Set((recent ?? []).map(getKey));
  const browseList = options?.filter((o) => !recentIds.has(getKey(o))).slice(0, RESULT_CAP) ?? [];

  const pick = (item: T) => {
    onChange(item);
    setQuery(renderLabel(item));
    setOpen(false);
  };

  return (
    <Box ref={ref} sx={{ position: "relative" }}>
      <Box sx={{ position: "relative" }}>
        <SearchIcon
          sx={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: t.muted2 }}
        />
        <Box
          component="input"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          sx={{ ...fieldInputSx(t), pl: 4 }}
        />
      </Box>

      {open && (
        <Box
          className="scroll-hidden"
          sx={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 280,
            overflowY: "auto",
            bgcolor: t.surface,
            border: "1px solid",
            borderColor: t.line,
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(16,24,40,0.10)",
          }}
        >
          {!options ? (
            <Typography sx={{ fontSize: 12.5, color: t.muted, px: 1.5, py: 1.25 }}>{loadingMessage}</Typography>
          ) : searchResults ? (
            searchResults.length === 0 ? (
              <Typography sx={{ fontSize: 12.5, color: t.muted, px: 1.5, py: 1.25 }}>
                {emptyMessage}
              </Typography>
            ) : (
              searchResults.map((o) => (
                <Box key={getKey(o)} onClick={() => pick(o)}>
                  {renderOption(o)}
                </Box>
              ))
            )
          ) : (
            <>
              {recent && recent.length > 0 && (
                <Box>
                  <Typography
                    sx={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: t.muted2,
                      px: 1.5,
                      pt: 1,
                      pb: 0.5,
                    }}
                  >
                    Recent
                  </Typography>
                  {recent.map((o) => (
                    <Box key={getKey(o)} onClick={() => pick(o)}>
                      {renderOption(o)}
                    </Box>
                  ))}
                </Box>
              )}
              {browseList.length > 0 && (
                <Box>
                  {recent && recent.length > 0 && (
                    <Typography
                      sx={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: t.muted2,
                        px: 1.5,
                        pt: 1,
                        pb: 0.5,
                      }}
                    >
                      All
                    </Typography>
                  )}
                  {browseList.map((o) => (
                    <Box key={getKey(o)} onClick={() => pick(o)}>
                      {renderOption(o)}
                    </Box>
                  ))}
                </Box>
              )}
              {browseList.length === 0 && (!recent || recent.length === 0) && (
                <Typography sx={{ fontSize: 12.5, color: t.muted, px: 1.5, py: 1.25 }}>
                  {emptyMessage}
                </Typography>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
