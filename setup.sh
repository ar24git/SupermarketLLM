#!/bin/bash

# SupermarketLLM - Quick Setup Script

echo "🥛🧀🫒 Setting up SupermarketLLM..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Install Node.js first."
    exit 1
fi

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Check for Ollama
if ! command -v ollama &> /dev/null; then
    echo "⚠️ Ollama not found. Installing..."
    curl -fsSL https://ollama.ai/install.sh | sh
fi

# Start Ollama and pull model
echo "🤖 Starting Ollama..."
ollama serve &
sleep 3

echo "📥 Pulling llama3.2 model (this may take a few minutes)..."
ollama pull llama3.2

# Start Expo
echo "🚀 Starting Expo..."
echo ""
echo "========================================"
echo "Open your phone and scan the QR code!"
echo "========================================"
echo ""

npx expo start
