/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#050816',
                card: '#1a1f3a',
                primary: '#6366f1', // Indigo
                coral: '#ff7f50',   // Coral
                indigoBrand: '#6366f1', // Indigo
                danger: '#f43f5e',
                warning: '#f59e0b',
                safe: '#10b981',
                textMain: '#f8fafc',
                textMuted: '#a5b4d4'
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
