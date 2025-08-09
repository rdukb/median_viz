import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#ffffff',
        card: '#fcfcff',
        text: '#222222',
        muted: '#6b7280',
        pastel: {
          blue: '#a5b4fc',
          green: '#86efac',
          yellow: '#fde68a',
          pink: '#f9a8d4',
          purple: '#c4b5fd',
        }
      },
      boxShadow: { soft: '0 10px 30px rgba(0,0,0,0.06)' },
      borderRadius: { '2xl': '1rem' }
    },
  },
  plugins: [],
}
export default config
