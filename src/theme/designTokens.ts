/**
 * DRIM Inventory System — Design Tokens
 * 
 * Professional industrial operations console with modern SaaS refinement.
 * Brand color: Orange #FF6B2C (from DRIM logo)
 */

export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const typography = {
  // Display/Headlines: Nunito (DreamsPOS font)
  display: {
    family: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    weight: {
      regular: 600,
      bold: 700,
    },
  },
  // Body/Interface: Nunito
  body: {
    family: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
    },
  },
  // Data/Monospace: JetBrains Mono or Fira Code
  mono: {
    family: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
    weight: {
      regular: 400,
      medium: 500,
    },
  },
} as const;

export const colors = {
  // Brand Primary (DreamsPOS orange)
  brand: {
    primary: '#FE9F43',
    primaryHover: '#F98C24',
    primaryActive: '#F07E12',
    primaryLight: '#FFF6EE',
    primaryDark: '#E67E0E',
  },

  // Neutral Scale (for direct color access)
  neutral: {
    0: '#F8FAFC',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#2D3748',
    900: '#1A1F26',
    950: '#0F1419',
  },
  
  // Light Mode
  light: {
    // Backgrounds
    bg: {
      primary: '#FAFAFA',
      secondary: '#F8FAFC',
      tertiary: '#F5F5F5',
      hover: '#F8F8F8',
      active: '#F0F0F0',
    },
    // Borders
    border: {
      subtle: '#E5E7EB',
      default: '#D1D5DB',
      strong: '#9CA3AF',
    },
    // Text
    text: {
      primary: '#111827',
      secondary: '#4B5563',
      tertiary: '#6B7280',
      muted: '#9CA3AF',
      inverse: '#F8FAFC',
    },
    // Surface (cards, modals)
    surface: {
      default: '#F8FAFC',
      elevated: '#F8FAFC',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
  },

  // Dark Mode
  dark: {
    // Backgrounds
    bg: {
      primary: '#0F1419',
      secondary: '#1A1F26',
      tertiary: '#232931',
      hover: '#2D3748',
      active: '#374151',
    },
    // Borders
    border: {
      subtle: '#2D3748',
      default: '#374151',
      strong: '#4B5563',
    },
    // Text
    text: {
      primary: '#F9FAFB',
      secondary: '#E5E7EB',
      tertiary: '#D1D5DB',
      muted: '#9CA3AF',
      inverse: '#111827',
    },
    // Surface (cards, modals)
    surface: {
      default: '#1A1F26',
      elevated: '#232931',
      overlay: 'rgba(0, 0, 0, 0.7)',
    },
  },

  // Semantic Colors (same for light/dark, adjust opacity as needed)
  semantic: {
    success: {
      main: '#10B981',
      bg: '#D1FAE5',
      border: '#6EE7B7',
      text: '#065F46',
    },
    warning: {
      main: '#F59E0B',
      bg: '#FEF3C7',
      border: '#FCD34D',
      text: '#92400E',
    },
    danger: {
      main: '#EF4444',
      bg: '#FEE2E2',
      border: '#FCA5A5',
      text: '#991B1B',
    },
    info: {
      main: '#3B82F6',
      bg: '#DBEAFE',
      border: '#93C5FD',
      text: '#1E40AF',
    },
  },

  // Stock Status Colors
  stock: {
    healthy: {
      main: '#10B981',
      bg: '#D1FAE5',
      text: '#065F46',
    },
    low: {
      main: '#F59E0B',
      bg: '#FEF3C7',
      text: '#92400E',
    },
    out: {
      main: '#EF4444',
      bg: '#FEE2E2',
      text: '#991B1B',
    },
    pending: {
      main: '#3B82F6',
      bg: '#DBEAFE',
      text: '#1E40AF',
    },
    partial: {
      main: '#8B5CF6',
      bg: '#EDE9FE',
      text: '#5B21B6',
    },
  },

  // Additional Color Scales
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
} as const;

export const shadows = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.08)',
  md: '0 4px 12px rgba(0, 0, 0, 0.10)',
  lg: '0 12px 24px rgba(0, 0, 0, 0.12)',
  xl: '0 20px 40px rgba(0, 0, 0, 0.15)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
} as const;

export const transitions = {
  fast: '150ms ease-out',
  normal: '250ms ease-out',
  slow: '350ms ease-out',
  bounce: '400ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

export const zIndex = {
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  toast: 1400,
  tooltip: 1500,
} as const;
