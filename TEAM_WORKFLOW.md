# Team Development Workflow

This document outlines the Git-based workflow for collaborative development of the SupermarketLLM app.

## 🎯 Workflow Overview

We use **Git Flow** with feature branches to enable safe parallel development:

```
main (stable, always deployable)
  ↑
develop (integration branch)
  ↑
feature-branches (individual features, merged after review)
```

## 📋 Prerequisites

1. **Git installed** (verify with `git --version`)
2. **Remote repository** set up (GitHub, GitLab, or self-hosted)
3. **Branch protection rules** configured

## 🚀 Setup Instructions

### 1. Create Branch Protection Rules

```bash
# In your Git repository settings, configure:
# - main branch: requires PR review, cannot force push
# - develop branch: requires PR review
# - All branches: require passing CI checks
```

### 2. Set Up Your Development Environment

```bash
# Clone the repository
cd /Users/arthur/SupermarketLLM
git remote -v  # Verify remote setup

# Create and push the develop branch
git checkout -b develop
git push -u origin develop

# Configure branch protection (done in GitHub/GitLab UI)
# - Require pull requests before merging
# - Require at least 1 reviewer approval
# - Include administrators in restrictions
```

### 3. Add Team Members

1. **Go to Repository Settings** → **Collaborators**
2. **Add each team member's GitHub username**
3. **Set appropriate permissions** (write, triage, or maintain)

## 🛠️ Daily Workflow

### For Feature Development

```bash
# 1. Sync with remote
git checkout develop
git pull origin develop

# 2. Create your feature branch
git checkout -b feature/price-tracker-integration

# 3. Make your changes
# ... edit files, add tests, etc ...

# 4. Commit your changes
git add .
git commit -m "feat: add price tracker screen with charts"
git commit -m "refactor: extract price data to separate module"

# 5. Push your branch
git push -u origin feature/price-tracker-integration

# 6. Create Pull Request (PR)
# - Go to GitHub/GitLab
# - Create PR from feature branch to develop
# - Add reviewers, describe changes
```

### For Code Review

```bash
# Review the changes
git fetch origin
git checkout feature/price-tracker-integration
git diff develop...feature/price-tracker-integration

# Test the feature locally
cd /Users/arthur/SupermarketLLM
npm install
npx expo start

# If everything looks good:
git checkout develop
git merge feature/price-tracker-integration
git push origin develop

# Delete the feature branch (optional, for cleanup)
git branch -d feature/price-tracker-integration
git push origin --delete feature/price-tracker-integration
```

### For Bug Fixes

```bash
# Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/bugfix-name

# Fix the bug
# ... changes ...

git commit -m "fix: resolve critical bug"
git push -u origin hotfix/bugfix-name
```

## 📝 Naming Conventions

| Branch Type | Prefix | Example |
|-------------|--------|---------|
| Feature | `feature/` | `feature/price-tracker` |
| Bug Fix | `fix/` or `hotfix/` | `fix/navigation-crash` |
| Improvement | `refactor/` | `refactor/chart-components` |
| Experiment | `experiment/` | `experiment/dark-mode` |

## 🔐 Branch Protection Rules

Configure these in your Git provider:

```
main branch:
  ✓ Require pull request before merging
  ✓ Require at least 1 reviewer
  ✓ Require status checks to pass
  ✓ Block force pushes
  ✓ Include administrators

develop branch:
  ✓ Require pull request before merging
  ✓ Require at least 1 reviewer
  ✓ Allow force pushes only with approval
  ✓ Block deletion

feature/* branches:
  ✓ No direct pushes (always via PR)
  ✓ Auto-mergeable after approval
```

## 🤝 Team Communication

### PR Checklist

Before creating a PR:
- [ ] Code is clean and follows style guide
- [ ] Tests pass (unit, integration)
- [ ] Documentation updated
- [ ] No breaking changes introduced
- [ ] Feature is tested locally

### Code Review Guidelines

1. **Review within 24 hours** (or less for critical fixes)
2. **Be specific and constructive** in feedback
3. **Use threads** for follow-up discussions
4. **Approve only when ready** to merge

## 📦 Deployment Strategy

### Development Branch (develop)
- Automatic deployment to staging environment
- Available for team testing
- Features in development here

### Production Branch (main)
- Manual deployment only
- Requires release tag
- Only fully tested, approved features

### Release Process

```bash
# 1. Merge all features into develop
git checkout develop
git pull origin develop

# 2. Create release branch
git checkout -b release/v1.2.0

# 3. Update version in package.json
# 4. Run tests
npm test

# 5. Merge to main and tag
git checkout main
git merge release/v1.2.0
git push origin main

# 6. Create tag
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin v1.2.0

# 7. Merge back to develop
git checkout develop
git merge main
git push origin develop

# 8. Delete release branch
git branch -d release/v1.2.0
git push origin --delete release/v1.2.0
```

## 🚨 Emergency Procedures

### Hotfix Process
1. Create `hotfix/` branch from `main`
2. Fix the critical issue
3. Create PR with urgency label
4. Deploy to main after approval
5. Update version and tag release

### Rollback Procedure
```bash
# If a release causes issues
git checkout main
git log --oneline  # Find last stable commit
git revert <commit-hash>  # Revert the problematic commit
```

## 📚 Additional Resources

- [GitHub Flow Guide](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Git Branching Strategies](https://git-scm.com/book/en/v2/Git-Branching-Branching-Strategies)
- [Team Collaboration Best Practices](https://docs.github.com/en/copilot/working-with-github-copilot/keeping-your-code-secure-and-collaborative)

## 🤔 Questions?

1. **Check this document first**
2. **Ask in team channel**
3. **Review PR comments for context**
4. **Check git history for decisions**

---

**Remember**: It's easier to ask for forgiveness than permission when it comes to small changes, but always communicate major changes!
