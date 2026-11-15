/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        muted: '#6e6e73',
        faint: '#86868b',
        line: '#e5e5e5',
        surface: '#ffffff',
        canvas: '#f5f5f7',
        accent: {
          DEFAULT: '#0071e3',
          hover: '#0077ed',
          pressed: '#0060c5',
        },
        success: '#1d7a3d',
        danger: '#c9242e',
        warning: '#8a5a00',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        lg: '12px',
      },
      spacing: {
        18: '4.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};
