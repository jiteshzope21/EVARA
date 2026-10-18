/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Forest Green (Primary Brand)
        forest: {
          50: '#f0f7f4',
          100: '#ddeee5',
          200: '#bdddc9',
          300: '#94c4a7',
          400: '#68a481',
          500: '#478663',
          600: '#346b4e',
          700: '#2a553f',
          800: '#234433',
          900: '#1d392b',
          950: '#0e1f17',
        },
        // Muted Sage Green (Secondary / Accent)
        sage: {
          50: '#f6f8f6',
          100: '#e9eee8',
          200: '#d4dfd2',
          300: '#b6c9b3',
          400: '#94af91',
          500: '#759471',
          600: '#5c7659',
          700: '#4a5e48',
          800: '#3c4c3b',
          900: '#323f31',
          950: '#1a2219',
        },
        // Warm Ivory / Soft Off-white Surfaces (Light Mode)
        ivory: {
          50: '#faf9f6',
          100: '#f5f3ee',
          200: '#ebe6dd',
          300: '#ded5c5',
          400: '#cdbfa7',
          500: '#b9a58b',
          600: '#a38d72',
          700: '#85715a',
          800: '#6c5c4a',
          900: '#584c3e',
        },
        // Refined Dark Mode Surfaces
        night: {
          950: '#0b0f0d',
          900: '#111714',
          850: '#151d19',
          800: '#1a231e',
          750: '#212c26',
          700: '#293730',
          600: '#384a42',
          500: '#4e655b',
        },
        // Restrained Teal Accent
        evarateal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // Remapped brand for seamless compatibility with existing markup
        brand: {
          50: '#f0f7f4',
          100: '#ddeee5',
          200: '#bdddc9',
          300: '#94c4a7',
          400: '#68a481',
          500: '#346b4e',
          600: '#2a553f',
          700: '#234433',
          800: '#1d392b',
          900: '#0e1f17',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
        'soft-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
        'inner-subtle': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}

