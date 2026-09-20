/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060E1A',
          900: '#0B1A2E',
          800: '#122744',
          700: '#1E3A5F',
          600: '#2A4D7A',
        },
        marine: {
          100: '#E3EDF7',
          200: '#C7DBF0',
          300: '#9BBDE3',
          400: '#6F9FD6',
          500: '#3B7DD8',
          600: '#2B5FA8',
        },
        surface: {
          50: '#FFFFFF',
          100: '#F8F9FA',
          200: '#F1F3F5',
          300: '#E8EAED',
          400: '#D1D5DB',
          500: '#9CA3AF',
        },
        risk: {
          low: '#2E7D4F',
          'low-bg': '#EBF5EF',
          moderate: '#C68A1D',
          'moderate-bg': '#FDF6E8',
          high: '#C0392B',
          'high-bg': '#FBEAEA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        topbar: '56px',
      },

    },
  },
  plugins: [],
};
