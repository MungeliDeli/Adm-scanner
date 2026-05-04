/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        airtel: {
          red: "#FF4B4B",
        },
      },
    },
  },
  plugins: [],
};

