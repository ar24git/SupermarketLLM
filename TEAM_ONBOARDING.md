# Team Onboarding Guide

Welcome to the SupermarketLLM development team! This guide will help you get started quickly.

## 🚀 Quick Start

### 1. Set Up Your Environment

```bash
# Clone the repository
git clone https://github.com/ar24git/SupermarketLLM.git
cd SupermarketLLM

# Install dependencies
npm install

# Set up Ollama (for LLM features)
# Download from https://ollama.ai
# Pull the model:
ollama pull llama3.2
```

### 2. Create Your Feature Branch

```bash
# Always work from a feature branch
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### 3. Make Your Changes

```bash
# Edit files, add tests, etc.
# ...

# Commit regularly with clear messages
git add .
git commit -m "feat: add [feature description]"
git commit -m "fix: resolve [issue]"
```

### 4. Push and Create PR

```bash
# Push your branch
git push -u origin feature/your-feature-name

# Create a Pull Request on GitHub
# - Add reviewers
# - Describe your changes
# - Link to any issues
```

## 📋 Development Guidelines

### Code Style

```typescript
// TypeScript rules:
// - Use strict mode
// - Add type annotations for all functions
// - Use descriptive variable names
// - Add comments for complex logic

// Example:
function calculatePrice(item: Item, quantity: number): number {
  const basePrice = item.basePrice * quantity;
  const discount = item.category === 'dairy' ? 0.1 : 0;
  return basePrice * (1 - discount);
}
```

### Commit Message Format

```
<type>: <description>

<body>
<footer>
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code restructuring
- `docs` - Documentation changes
- `test` - Adding tests
- `chore` - Maintenance tasks

### Branch Naming

- Features: `feature/` - e.g., `feature/price-tracker`
- Fixes: `fix/` - e.g., `fix/navigation-crash`
- Experiments: `experiment/` - e.g., `experiment/dark-mode`

## 🔄 Pull Request Process

### Before Creating PR

- [ ] Code is working and tested
- [ ] Commit messages are clear
- [ ] No `console.log` statements (use proper logging)
- [ ] Types are correctly defined
- [ ] Documentation is updated

### PR Template

```
## What does this PR do?

## How to test?

## Screenshots (if UI changes)

## Related issues

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] CI checks passing
```

### Review Process

1. **Author creates PR**
2. **At least 1 team member reviews**
3. **Author addresses feedback**
4. **PR merged after approval**
5. **Feature branch deleted** (optional cleanup)

## 🏗️ Feature Branch Workflow

```
main (stable)
  ↑
develop (integration)
  ↑
feature-1  feature-2  feature-3
```

Each developer:
1. Creates a feature branch from `develop`
2. Works on their feature
3. Creates PR when ready
4. After approval, PR is merged to `develop`
5. `develop` is merged to `main` for releases

## 🎯 Current Status

### In Progress
- Price Tracker screen integration ✅
- Feature branch workflow 🔄 (just set up)

### Next Features (Available for Development)
- Real-time price data from crawler
- User favorites system
- Dark mode support
- Price alerts and notifications
- CSV/PDF export

### How to Choose a Feature

1. **Check current issues** in GitHub Issues
2. **Ask the team** about upcoming features
3. **Create your own feature branch** for experiments
4. **Document your work** in the feature branch

## 💬 Communication

### Tools
- **Slack/Discord** - Quick questions and discussions
- **GitHub Issues** - Feature requests and bug reports
- **GitHub Projects** - Task tracking
- **PR comments** - Code-specific discussions

### Meeting Schedule (Optional)
- Weekly sync: every Friday 10:00
- Sprint planning: first Monday of each month
- Demo day: last Friday of each month

## 🛠️ Common Tasks

### Add a New Supermarket

1. Create feature branch
2. Update price data structure
3. Add to supermarkets array
4. Update charts to include new store
5. Test all screens
6. Create PR

### Add a New Category

1. Create feature branch
2. Update commonItems array
3. Add to category list
4. Update filtering logic
5. Test category navigation
6. Create PR

## 🚨 Emergency Procedures

### Critical Bug Fix

```bash
# Hotfix workflow:
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug
# Fix the bug
git commit -m "fix: critical bug description"
git push -u origin hotfix/critical-bug
# Create PR with "URGENT" label
# Merge after approval
```

### Release Process

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0
# Update version in package.json
# Run tests
npm test
# Merge to main
git checkout main
git merge release/v1.2.0
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main
git push origin v1.2.0
```

## 📚 Additional Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)
- [Git Book](https://git-scm.com/book/en/v2/)

## ❓ Need Help?

1. Check this guide first
2. Ask in team channel
3. Review existing PRs for patterns
4. Check git history for context

---

**Remember:** The goal is to ship quality features quickly while maintaining code quality. Don't hesitate to ask questions!
