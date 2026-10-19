/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#20231f',
        canvas: '#f4f1ea',
        citron: '#d7f357',
        // Preflight's placeholder and default border greys, mapped to Palette Neutral Gray.
        gray: { 200: '#b6bfc1', 400: '#b6bfc1' },
      },
      borderColor: { DEFAULT: '#b6bfc1' },
      fontFamily: {
        sans: ['"Source Sans 3"', 'sans-serif'],
        display: ['"Source Sans 3"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
