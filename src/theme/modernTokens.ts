// Modern Design System Tokens for DRIM Inventory System
// Inspired by contemporary POS/inventory dashboards

export const modernTokens = {
  // Brand Colors
  brand: {
    primary: "#FF6B2C", // DRIM Orange
    primaryDark: "#E55A1F", // Hover/Active
    primaryLight: "#FF8A5B", // Light accents
    primaryTint: "#FFF4F0", // Very light backgrounds
  },

  // Light Mode
  light: {
    // Backgrounds
    background: "#F8FAFC", // slate-50
    surface: "#F8FAFC",
    surfaceHover: "#F1F5F9", // slate-100
    surfaceActive: "#E2E8F0", // slate-200

    // Text
    textPrimary: "#1E293B", // slate-800
    textSecondary: "#64748B", // slate-500
    textMuted: "#94A3B8", // slate-400
    textDisabled: "#CBD5E1", // slate-300

    // Borders
    border: "#E2E8F0", // slate-200
    borderHover: "#CBD5E1", // slate-300
    divider: "#F1F5F9", // slate-100

    // Shadows (for inline use)
    shadowSm: "0 1px 2px rgba(0, 0, 0, 0.05)",
    shadowMd: "0 4px 6px rgba(0, 0, 0, 0.1)",
    shadowLg: "0 10px 15px rgba(0, 0, 0, 0.1)",
    shadowXl: "0 20px 25px rgba(0, 0, 0, 0.15)",
  },

  // Dark Mode
  dark: {
    // Backgrounds
    background: "#0F172A", // slate-950
    surface: "#1E293B", // slate-800
    surfaceHover: "#334155", // slate-700
    surfaceActive: "#475569", // slate-600

    // Text
    textPrimary: "#F1F5F9", // slate-100
    textSecondary: "#CBD5E1", // slate-300
    textMuted: "#94A3B8", // slate-400
    textDisabled: "#64748B", // slate-500

    // Borders
    border: "#334155", // slate-700
    borderHover: "#475569", // slate-600
    divider: "#1E293B", // slate-800

    // Shadows (darker for dark mode)
    shadowSm: "0 1px 2px rgba(0, 0, 0, 0.3)",
    shadowMd: "0 4px 6px rgba(0, 0, 0, 0.4)",
    shadowLg: "0 10px 15px rgba(0, 0, 0, 0.5)",
    shadowXl: "0 20px 25px rgba(0, 0, 0, 0.6)",
  },

  // Semantic Colors
  semantic: {
    success: "#10B981", // emerald-500
    successLight: "#D1FAE5", // emerald-100
    successDark: "#059669", // emerald-600

    warning: "#F59E0B", // amber-500
    warningLight: "#FEF3C7", // amber-100
    warningDark: "#D97706", // amber-600

    error: "#EF4444", // red-500
    errorLight: "#FEE2E2", // red-100
    errorDark: "#DC2626", // red-600

    info: "#3B82F6", // blue-500
    infoLight: "#DBEAFE", // blue-100
    infoDark: "#2563EB", // blue-600
  },

  // Stock Status Colors
  stock: {
    healthy: "#10B981", // green-500 (above min level)
    healthyLight: "#D1FAE5", // green-100
    low: "#F59E0B", // amber-500 (at/near min level)
    lowLight: "#FEF3C7", // amber-100
    out: "#EF4444", // red-500 (zero stock)
    outLight: "#FEE2E2", // red-100
    pending: "#F59E0B", // amber-500 (MRF pending)
    pendingLight: "#FEF3C7", // amber-100
  },

  // Spacing (8px grid)
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
    "3xl": "64px",
    "4xl": "80px",
  },

  // Border Radius
  radius: {
    none: "0",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "24px",
    full: "9999px",
  },

  // Typography Scale (1.25 ratio)
  fontSize: {
    xs: "12px",
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "30px",
    "4xl": "36px",
    "5xl": "48px",
  },

  // Line Heights
  lineHeight: {
    xs: "16px",
    sm: "20px",
    base: "24px",
    lg: "28px",
    xl: "28px",
    "2xl": "32px",
    "3xl": "36px",
    "4xl": "40px",
    "5xl": "1",
  },

  // Font Weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Font Families
  fontFamily: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", Consolas, Monaco, monospace',
  },

  // Z-Index Scale
  zIndex: {
    dropdown: 10,
    sticky: 20,
    overlay: 30,
    modal: 40,
    toast: 50,
    tooltip: 60,
  },

  // Transitions
  transition: {
    fast: "150ms",
    normal: "250ms",
    slow: "350ms",
    easeOut: "cubic-bezier(0.33, 1, 0.68, 1)",
    easeIn: "cubic-bezier(0.32, 0, 0.67, 0)",
    easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  },

  // Breakpoints
  breakpoint: {
    mobile: "768px",
    tablet: "1024px",
    desktop: "1280px",
    wide: "1536px",
  },
} as const;

// Helper function to get current mode tokens
export function getTokens(mode: "light" | "dark") {
  return {
    ...modernTokens,
    current: mode === "dark" ? modernTokens.dark : modernTokens.light,
  };
}

// Export type for TypeScript
export type ModernTokens = typeof modernTokens;
export type TokenMode = ReturnType<typeof getTokens>;
