/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './hooks/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#060816',
        surface: '#101528',
        'surface-strong': '#161d34',
        'surface-muted': '#0b1020',
        line: '#27304f',
        accent: '#5eead4',
        info: '#60a5fa',
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#fb7185',
        text: '#f5f7ff',
        'text-muted': '#98a2c9'
      },
      boxShadow: {
        glow: '0 18px 45px rgba(7, 10, 24, 0.5)'
      },
      borderRadius: {
        '4xl': '2rem'
      }
    }
  },
  plugins: []
};

export default config;
