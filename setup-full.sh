#!/bin/bash
# Complete reset and setup for SupermarketLLM
# Run this in your terminal

echo "🛒 SupermarketLLM Full Setup"
echo "============================"

cd SupermarketLLM

# Remove old node_modules and lock file
echo "Cleaning old files..."
rm -rf node_modules package-lock.json

# Install fresh
echo "Installing dependencies..."
npm install

# Install Expo recommended packages
echo "Setting up Expo packages..."
npx expo install

# Check if TypeScript got installed
if [ ! -d "node_modules/typescript" ]; then
    echo "Installing TypeScript manually..."
    npm install typescript --save-dev
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Starting app..."
echo ""

# Start the app
npm start