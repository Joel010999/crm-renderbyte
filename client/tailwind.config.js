/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Base backgrounds
                background: "#05060a",
                "background-secondary": "#0b0f1a",
                panel: "#0b1020",
                "panel-lighter": "#101a2f",
                border: "rgba(255, 255, 255, 0.06)",
                "border-light": "rgba(255, 255, 255, 0.1)",

                // Accent colors - Neon style
                accent: "#8b5cf6",           // Violet/purple main
                "accent-pink": "#ec4899",     // Pink/magenta for today
                "accent-purple": "#a855f7",   // Purple for week
                "accent-cyan": "#06b6d4",     // Cyan for month
                "accent-blue": "#3b82f6",     // Blue for buttons
                "accent-teal": "#14b8a6",     // Teal for chips
                "accent-red": "#dc2626",      // Red for danger
                "accent-green": "#22c55e",    // Green for online status

                // Leaderboard medals
                gold: "#fbbf24",
                "gold-bg": "rgba(251, 191, 36, 0.15)",
                silver: "#94a3b8",
                "silver-bg": "rgba(148, 163, 184, 0.15)",
                bronze: "#cd7f32",
                "bronze-bg": "rgba(205, 127, 50, 0.15)",
            },
            fontFamily: {
                mono: ['JetBrains Mono', 'Consolas', 'monospace'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'xl': '16px',
                '2xl': '20px',
                '3xl': '24px',
            },
            boxShadow: {
                'glow': '0 0 20px rgba(139, 92, 246, 0.15)',
                'glow-pink': '0 0 20px rgba(236, 72, 153, 0.2)',
                'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.2)',
                'glow-blue': '0 0 20px rgba(59, 130, 246, 0.2)',
                'glow-gold': '0 0 15px rgba(251, 191, 36, 0.25)',
                'glow-green': '0 0 15px rgba(34, 197, 94, 0.25)',
                'card': '0 8px 32px rgba(0, 0, 0, 0.4)',
            },
            backgroundImage: {
                'gradient-card': 'linear-gradient(135deg, #0b1020 0%, #101a2f 100%)',
                'gradient-header': 'linear-gradient(90deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'pulse-slow': 'pulse 3s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                }
            }
        },
    },
    plugins: [],
}
