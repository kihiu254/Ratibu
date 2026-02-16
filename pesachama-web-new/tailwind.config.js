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
        primary: "#00C853", // Ratibu Green
        accent: "#B91C1C", // Ratibu Red
        secondary: "#06b6d4", // Cyan highlights
        midnight: "#020617", // Slate 950
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "sans-serif"],
        display: ["Outfit", "sans-serif"],
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(22, 193, 114, 0.4)',
        'glow-orange': '0 0 20px rgba(255, 140, 66, 0.4)',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
