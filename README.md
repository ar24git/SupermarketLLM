# SupermarketLLM 🥛🧀🫒

A multilingual (English/Greek) mobile app that uses a local LLM via Ollama to help users compare prices across Greek supermarkets.

## Features

- 🤖 **Local LLM** - Runs entirely on your device using Ollama
- 🌐 **Multilingual** - Supports English and Greek (Ελληνικά)
- 🏪 **Greek Supermarkets** - Sklavenitis, Masoutis, Lidl, My Market, AB, Koutoudis
- 💬 **Conversational** - Ask questions like "What's the cheapest milk?"

## Prerequisites

1. **Node.js** 18+
2. **Expo** (`npm install -g expo-cli`)
3. **Ollama** - Download from https://ollama.ai

## Setup

```bash
# Install dependencies
cd SupermarketLLM
npm install

# Start Ollama and pull a model
ollama serve
ollama pull llama3.2

# Run the app
npx expo start
```

## Running on Mobile

### iOS
```bash
npx expo start --ios
```

### Android
```bash
npx expo start --android
```

## How It Works

1. The app connects to Ollama running locally on port 11434
2. User asks a price question in English or Greek
3. The LLM (llama3.2) uses the built-in price database to answer
4. Responses are localized to the user's language

## Tech Stack

- **Frontend**: React Native + Expo
- **LLM**: Ollama (llama3.2)
- **i18n**: react-i18next
- **Language**: TypeScript

## Project Structure

```
src/
├── data/           # Sample price data
├── locales/        # i18n translations
├── screens/        # UI screens
├── services/       # Ollama integration
├── types/          # TypeScript interfaces
└── App.tsx         # Entry point
```

## License

MIT
