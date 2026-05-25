#!/bin/bash

# Team Onboarding Script
# This script helps team members set up their development environment

echo "🚀 SupermarketLLM Team Onboarding"
echo "================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm"
    exit 1
fi

echo "✅ npm found: $(npm --version)"

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx is not installed. Please install npm"
    exit 1
fi

echo "✅ npx found: $(npx --version)"

# Check if Ollama is installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is installed"
    
    # Check if llama3.2 model is pulled
    if ollama list | grep -q llama3.2; then
        echo "✅ llama3.2 model is available"
    else
        echo "⏳ Pulling llama3.2 model (this may take a few minutes)..."
        ollama pull llama3.2
    fi
else
    echo "⚠️  Ollama is not installed. Please download from https://ollama.ai"
    echo "   Ollama is required for LLM features (optional for testing)"
fi

# Navigate to project directory
echo ""
echo "📁 Setting up project..."
cd "$(dirname "$0")"

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if Expo is installed
if command -v npx &> /dev/null; then
    echo "✅ Expo CLI is available"
fi

# Create a .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    echo "# SupermarketLLM Configuration" > .env
    echo "OLLAMA_URL=http://localhost:11434" >> .env
    echo "API_KEY=your-api-key-here" >> .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Create feature branch for new work
echo ""
echo "_git branch -m feature/new-feature-$(date +%Y%m%d)"

echo ""
echo "================================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npx expo start' to start the development server"
echo "2. Visit http://localhost:8080 in your browser"
echo "3. Create a feature branch: git checkout -b feature/your-feature"
echo ""
echo "📚 See TEAM_ONBOARDING.md for detailed onboarding guide"
