/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        orca: {
          950: '#060B13', // Deepest canvas background
          900: '#0A101D', // Primary app container
          850: '#0E1726', // Standard card surface
          800: '#131F33', // Elevated card / row
          750: '#182740', // Hover highlight
          700: '#1E3252', // Border standard
          600: '#2A436D', // Border active
          500: '#0284C7', // Accent blue
          400: '#38BDF8', // Highlight cyan
        },
        navy: {
          950: '#060B13',
          900: '#0A101D',
          800: '#0E1726',
          700: '#182740',
          600: '#2A436D',
        },
        marine: {
          100: '#0F2744',
          200: '#173B66',
          300: '#1E4F8A',
          400: '#38BDF8',
          500: '#0284C7',
          600: '#0369A1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '3xs': ['0.625rem', { lineHeight: '0.875rem' }],
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        topbar: '56px',
      },
    },
  },
  plugins: [],
};
