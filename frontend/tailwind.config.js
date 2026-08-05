/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './navigation/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#F97316',
        'primary-dark': '#EA580C',
        'primary-light': '#FED7AA',
        secondary: '#1E293B',
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        surface: '#FFFFFF',
        'surface-dark': '#1E293B',
        'surface-2': '#F8FAFC',
        'surface-2-dark': '#0F172A',
        'on-surface': '#1E293B',
        'on-surface-dark': '#F8FAFC',
        muted: '#64748B',
        'muted-dark': '#94A3B8',
        border: '#E2E8F0',
        'border-dark': '#334155',
        card: '#FFFFFF',
        'card-dark': '#1E293B',
      },
      fontFamily: {
        sans: ['System', 'ui-sans-serif'],
        mono: ['Courier', 'ui-monospace'],
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      spacing: {
        '18': '72px',
        '22': '88px',
      },
    },
  },
  plugins: [],
};
