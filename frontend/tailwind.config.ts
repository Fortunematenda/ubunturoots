import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        ubuntu: {
          green: '#1F5F46',
          gold: '#C7A248',
          white: '#FAFAF8',
          gray: '#E7E8E5',
          text: '#1B1F1D'
        }
      },
      fontFamily: {
        display: ['Merriweather', 'serif'],
        body: ['Nunito Sans', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
