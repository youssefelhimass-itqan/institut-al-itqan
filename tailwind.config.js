/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bordeaux: {
          DEFAULT: '#7a2038',
          dark: '#5c1a2e',
          light: '#f5e8ee',
        },
        gold: '#c4a265',
        beige: '#faf8f5',
      },
      fontFamily: {
        arabic: ['Amiri', 'serif'],
        sans: ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
