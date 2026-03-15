#!/bin/bash
# SupermarketLLM - Easy Setup Script
# Run this on your local machine (Windows/Mac/Linux)

echo "🛒 SupermarketLLM Setup"
echo "======================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✅ npm: $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Install Expo CLI recommended versions
echo ""
echo "🔧 Setting up Expo..."
npx expo install

# Check for Ollama (optional)
if command -v ollama &> /dev/null; then
    echo ""
    echo "🤖 Ollama found: $(ollama --version)"
    echo "   To use LLM, run: ollama serve && ollama pull llama3.2"
else
    echo ""
    echo "⚠️  Ollama not found (optional - for LLM features)"
    echo "   Install from: https://ollama.ai"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To run the app:"
echo "  npm start        # Start Expo dev server"
echo ""
echo "Then scan the QR code with your phone (Expo Go app)"
echo "Or press 'w' for web, 'a' for Android emulator, 'i' for iOS"