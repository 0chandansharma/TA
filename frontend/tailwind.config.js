/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  prefix: "",
  theme: {
    extend: {
      fontFamily: {
        'serif': ['Rubik', 'ui-sans-serif'],
        'sans': ['Roboto', 'ui-sans'],
      },
      colors: {
        prime: '#D3FDEE',
        primeDark: '#6AFBC6',
        primeLight: '#C5EFE0',
        assent: '#DF6D97',
        mainWhite: '#FDFFFE',
        txtMain: '#222B35',
        txtChat: '#222a35',
        chSend: '#e9fef7',
        chRecv: '#a5fcdc',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
    screens: {
      'xs': '425px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    }
  },
  variants: {
    zIndex: ['responsive', 'hover'],
    position: ['responsive', 'hover'],
    padding: ['responsive', 'last'],
    margin: ['responsive', 'last'],
    borderWidth: ['responsive', 'last'],
    backgroundColor: ['responsive', 'hover', 'dark'],
    borderColor: ['responsive', 'hover', 'dark'],
    borderWidth: ['responsive', 'hover', 'dark'],
    textColor: ['responsive', 'hover', 'dark'],
    extend: {
      borderRadius: ['hover'],
      transitionProperty: ['hover'],
      width: ['hover'],
    },
  },
  plugins: [require("tailwindcss-animate")],
}

