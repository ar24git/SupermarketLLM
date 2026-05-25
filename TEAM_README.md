# SupermarketLLM - Team Repository

A multilingual (English/Greek) mobile app that uses a local LLM via Ollama to help users compare prices across Greek supermarkets.

## 👥 Team Development

This repository uses **Git feature branches** for collaborative development. See:

- [TEAM_WORKFLOW.md](./TEAM_WORKFLOW.md) - Git workflow and branch strategy
- [TEAM_ONBOARDING.md](./TEAM_ONBOARDING.md) - Onboarding guide for new team members

### Current Status

- **Main Branch**: Stable, production-ready
- **Develop Branch**: Integration testing
- **Feature Branches**: Individual feature development

### Active Feature Branches

| Branch | Description | Status |
|--------|-------------|--------|
| `feature/price-tracker-integration` | Price Tracker UI | Merged ✅ |
| - | - | - |

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/ar24git/SupermarketLLM.git
cd SupermarketLLM

# Install dependencies
npm install

# Set up Ollama (required for LLM features)
# Download from https://ollama.ai
ollama pull llama3.2

# Run the app
npx expo start
```

## 📁 Project Structure

```
SupermarketLLM/
├── App.tsx                     # Main application entry point
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── src/
│   ├── screens/
│   │   ├── ChatScreen.tsx      # Main chat interface
│   │   └── PriceTrackerScreen.tsx  # Price comparison UI
│   ├── services/
│   │   ├── ollama.ts           # LLM integration
│   │   └── priceIndex.ts       # Price data management
│   ├── data/
│   │   └── superMarkets.ts     # Store data
│   └── locales/
│       └── i18n.ts             # Multilingual support
└── docs/                       # Documentation
```

## 🛠️ Development

### Running Locally

```bash
npx expo start
```

### Available Scripts

```json
{
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "crawl:install": "cd scripts/crawler && npm install && npx playwright install chromium",
  "crawl:basket": "npx tsx scripts/crawler/src/index.ts --mode basket"
}
```

## 🌍 Features

### Price Tracker

- Compare prices across 4 supermarkets (Carrefour, Makro, Bazaar, Green Market)
- 100 common Greek items across 11 categories
- Interactive charts (bar, pie, radar)
- Search and filter functionality
- Price change tracking (↑/↓/→)

### Multilingual Support

- English (EN)
- Greek (Ελληνικά)

### LLM Integration

- Uses local Ollama for privacy
- llama3.2 model
- Conversational price assistant

## 📊 Branch Strategy

```
main (stable, deployable)
  ↑
develop (integration)
  ↑
feature-branches (individual features)
```

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Commit: `git commit -m "feat: add your feature"`
4. Push: `git push -u origin feature/your-feature`
5. Create a Pull Request on GitHub

See [TEAM_WORKFLOW.md](./TEAM_WORKFLOW.md) for details.

## 🐛 Issues

Report issues in GitHub Issues. Label them appropriately:
- `bug` - Bug report
- `feature` - Feature request
- `urgent` - Critical issue
- `question` - Question

## 📝 License

MIT License - See LICENSE file for details.

## 👤 Team

- **Project Lead**: Antonyuk Konstantinos (Arthur)
- **Repository**: https://github.com/ar24git/SupermarketLLM

## 📞 Contact

- GitHub Issues: For bug reports and feature requests
- Team Channel: For development discussions
