/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2F62B0',
          deep: '#1E4074',
          light: '#EBF1FA',
        },
        workshop: {
          green: '#3E7A52',
          'green-bg': 'rgba(62,122,82,0.12)',
          amber: '#B9791E',
          'amber-bg': 'rgba(185,121,30,0.14)',
          red: '#B24A34',
          'red-bg': 'rgba(178,74,52,0.12)',
          surface: '#FFFFFF',
          border: 'rgba(20,23,27,0.12)',
          'border-soft': 'rgba(20,23,27,0.06)',
          bg: '#F5F6F8',
          text: '#1A1D22',
          muted: '#656B72'
        }
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
