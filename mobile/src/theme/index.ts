export const Colors = {
  primary: '#7C3AED',
  primaryLight: 'rgba(124, 58, 237, 0.1)',
  primaryMedium: 'rgba(124, 58, 237, 0.25)',

  background: '#F8F7FF',
  card: '#FFFFFF',
  border: '#E5E7EB',
  separator: '#F3F4F6',

  text: '#111827',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',

  destructive: '#DC2626',
  destructiveLight: 'rgba(220, 38, 38, 0.1)',
  success: '#16A34A',
  successLight: 'rgba(22, 163, 74, 0.1)',
  warning: '#D97706',
  warningLight: 'rgba(217, 119, 6, 0.1)',

  badge: '#F3F4F6',
  badgeText: '#374151',

  // Category colors
  family: '#2563EB',
  familyLight: 'rgba(37, 99, 235, 0.08)',
  familyBorder: 'rgba(37, 99, 235, 0.2)',

  friends: '#7C3AED',
  friendsLight: 'rgba(124, 58, 237, 0.08)',
  friendsBorder: 'rgba(124, 58, 237, 0.2)',

  professional: '#059669',
  professionalLight: 'rgba(5, 150, 105, 0.08)',
  professionalBorder: 'rgba(5, 150, 105, 0.2)',

  other: '#D97706',
  otherLight: 'rgba(217, 119, 6, 0.08)',
  otherBorder: 'rgba(217, 119, 6, 0.2)',
};

export const Typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: Colors.text },
  h2: { fontSize: 22, fontWeight: '700' as const, color: Colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, color: Colors.text },
  h4: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  body: { fontSize: 14, fontWeight: '400' as const, color: Colors.text },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, color: Colors.textMuted },
  label: { fontSize: 13, fontWeight: '500' as const, color: Colors.textMuted },
  caption: { fontSize: 11, fontWeight: '400' as const, color: Colors.textLight },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};
