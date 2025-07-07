/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      './src/**/*.{js,ts,jsx,tsx}',   // All files in src directory
      './app/**/*.{js,ts,jsx,tsx}',   // Next.js app directory
      './pages/**/*.{js,ts,jsx,tsx}', // if you have pages folder
      './components/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
      extend: {},
    },
    plugins: [],
  };
  