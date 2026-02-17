/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#db681d',
        'primary-dark': '#c05a18',
        'primary-light': '#e68543'
      }
    },
  },
  plugins: [],
}
