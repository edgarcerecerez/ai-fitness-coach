/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'oklch(0.65 0.12 140)',
          foreground: 'oklch(0.985 0.001 106.423)',
        },
        secondary: {
          DEFAULT: 'oklch(0.97 0.001 106.424)',
          foreground: 'oklch(0.216 0.006 56.043)',
        },
        muted: {
          DEFAULT: 'oklch(0.97 0.001 106.424)',
          foreground: 'oklch(0.553 0.013 58.071)',
        },
        accent: {
          DEFAULT: 'oklch(0.97 0.001 106.424)',
          foreground: 'oklch(0.216 0.006 56.043)',
        },
        destructive: {
          DEFAULT: 'oklch(0.577 0.245 27.325)',
          foreground: 'oklch(0.985 0.001 106.423)',
        },
        border: 'oklch(0.923 0.003 48.717)',
        input: 'oklch(0.923 0.003 48.717)',
        ring: 'oklch(0.709 0.01 56.259)',
        chart: {
          1: 'oklch(0.646 0.222 41.116)',
          2: 'oklch(0.6 0.118 184.704)',
          3: 'oklch(0.398 0.07 227.392)',
          4: 'oklch(0.828 0.189 84.429)',
          5: 'oklch(0.769 0.188 70.08)',
        },
        sidebar: {
          DEFAULT: 'oklch(0.985 0.001 106.423)',
          foreground: 'oklch(0.147 0.004 49.25)',
          primary: 'oklch(0.65 0.12 140)',
          'primary-foreground': 'oklch(0.985 0.001 106.423)',
          accent: 'oklch(0.97 0.001 106.424)',
          'accent-foreground': 'oklch(0.216 0.006 56.043)',
          border: 'oklch(0.923 0.003 48.717)',
          ring: 'oklch(0.709 0.01 56.259)',
        },
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
      },
    },
  },
  plugins: [],
}
