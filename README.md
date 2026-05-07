<img width="1920" height="1200" alt="image" src="https://github.com/user-attachments/assets/e358a779-4f2e-4395-8fe2-44e02cea4a3d" /># 🛡️ SafeWalk: Personal Guardian Platform

SafeWalk is a modern, mobile-first safety application designed to provide both **Predictive** and **Reactive** security for users. It leverages AI-driven monitoring, real-time location tracking, and an integrated Telegram Guardian system to ensure you're never walking alone.

# Deloyed Link: https://safewalk-76e63.web.app

## ✨ Features

- **Predictive Monitoring**: AI-assisted route analysis and safety timers.
- **Instant SOS**: One-tap emergency broadcast to all registered guardians.
- **Telegram Integration**: Connect guardians directly via Telegram for real-time automated alerts.
- **Live Risk Map**: Visual representation of safe and risky zones.
- **Premium UI/UX**: Dark-mode optimized, glassmorphic design with smooth animations.
- **Firebase Backend**: Secure Google Authentication and Firestore real-time synchronization.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Firebase (Auth & Firestore)
- **Guardian Sync**: Node.js (Telegram Bot API)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Firebase Project
- Telegram Bot Token

### Installation

1. Clone the repo
2. `npm install`
3. Create `.env` with your Firebase and Telegram keys.
4. Add your `serviceAccountKey.json` to the root.

### Running the App

- **Start Web App**: `npm run dev`
- **Start Bot Server**: `node bot_server.cjs`

## 📄 License
MIT
