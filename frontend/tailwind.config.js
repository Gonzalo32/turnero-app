/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#866385',
          'purple-dark': '#6a3260',
          'purple-light': '#a382a2',
          silver: '#cbcbcc',
          tan: '#e2dbd7',
        },
        app: {
          main: '#f7f6f8',
          card: '#ffffff',
          'card-hover': '#faf9fb',
          text: '#2b252f',
          muted: '#73687a',
        }
      },
      fontFamily: {
        brand: ['Cinzel', 'serif'],
        body: ['Montserrat', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
