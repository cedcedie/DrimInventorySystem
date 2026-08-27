"use client";

import { useMemo } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

const RESULT_CAP = 8;

/**
 * Generic search-filtered dropdown (MUI `Autocomplete`), replacing a raw
 * `<Select>` for lists that can grow past a screenful (products, suppliers,
 * MRF line items). Typing narrows by whatever `matches` checks; the
 * closed/empty-query view shows "recent" items first (if given), grouped
 * apart from the rest, capped at RESULT_CAP.
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

  const recentIds = useMemo(() => new Set((recent ?? []).map(getKey)), [recent, getKey]);

  // Recent items first (their own group), then the rest — same ordering the
  // hand-rolled version showed for an empty query, now via Autocomplete's groupBy.
  const orderedOptions = useMemo(() => {
    const rest = (options ?? []).filter((o) => !recentIds.has(getKey(o)));
    return [...(recent ?? []), ...rest];
  }, [options, recent, recentIds, getKey]);

  const selected = value ? (options?.find((o) => getKey(o) === value) ?? null) : null;

  return (
    <Autocomplete<T>
      value={selected}
      onChange={(_, next) => {
        if (next) onChange(next);
      }}
      options={orderedOptions}
      loading={!options}
      loadingText={loadingMessage}
      noOptionsText={emptyMessage}
      getOptionLabel={renderLabel}
      isOptionEqualToValue={(option, val) => getKey(option) === getKey(val)}
      groupBy={recent && recent.length > 0 ? (option) => (recentIds.has(getKey(option)) ? "Recent" : "All") : undefined}
      filterOptions={(opts, state) => {
        const needle = state.inputValue.trim().toLowerCase();
        const filtered = needle ? opts.filter((o) => matches(o, needle)) : opts;
        return filtered.slice(0, RESULT_CAP);
      }}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <li key={key} {...optionProps} style={{ padding: 0 }}>
            {renderOption(option)}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: t.surface,
              borderRadius: "8px",
              fontSize: 12.5,
            },
          }}
        />
      )}
      slotProps={{
        paper: {
          sx: {
            bgcolor: t.surface,
            border: "1px solid",
            borderColor: t.line,
            boxShadow: "0 4px 12px rgba(16,24,40,0.10)",
          },
        },
        listbox: { className: "scroll-hidden", sx: { maxHeight: 280 } },
      }}
    />
  );
}
