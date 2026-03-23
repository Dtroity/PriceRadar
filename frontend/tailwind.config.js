/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: ['Golos Text', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        brand: {
          primary: '#4F46E5',
          deep: '#3730A3',
          from: '#4F46E5',
          to: '#0EA5E9',
          onDark: '#EEF2FF',
        },
        surface: {
          DEFAULT: '#faf8f5',
          raised: '#f3f0ea',
        },
        warm: {
          border: '#e8e4dc',
          accent: '#b45309',
        },
      },
    },
  },
  plugins: [],
};
