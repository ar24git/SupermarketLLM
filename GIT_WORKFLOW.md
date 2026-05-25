# Git Workflow - Team Standard

This is our team's Git workflow. Keep it in mind for all feature development.

## 🎯 Standard Workflow

```bash
# 1. Start a new feature
git checkout -b feature/<thing>

# 2. Make your changes
# ...work...

# 3. Push to remote (backup and share)
git push -u origin feature/<thing>

# 4. When ready to merge:
git checkout main
git merge feature/<thing>
git push

# 5. Clean up local and remote branch
git branch -d feature/<thing>
git push origin --delete feature/<thing>
```

## 📋 Quick Reference

| Action | Command |
|--------|---------|
| Create feature | `git checkout -b feature/name` |
| Push branch | `git push -u origin feature/name` |
| Merge to main | `git checkout main && git merge feature/name && git push` |
| Delete branch (local) | `git branch -d feature/name` |
| Delete branch (remote) | `git push origin --delete feature/name` |
| Update from remote | `git pull origin main` |

## 💡 Best Practices

- **Branch naming**: `feature/` prefix for features
- **Commit messages**: Start with `feat:`, `fix:`, `refactor:`, etc.
- **PR before merge**: Create Pull Request for review
- **Test before merge**: Ensure changes work locally
- **Clean up**: Delete branches after merging

## 🔄 Example: Adding a New Feature

```bash
# 1. Create branch for new feature
git checkout -b feature/price-tracker

# 2. Work on the feature
# ...edit files, test, commit...

git add .
git commit -m "feat: add price tracker screen"
git push -u origin feature/price-tracker

# 3. After review and testing:
git checkout main
git pull origin main
git merge feature/price-tracker
git push

# 4. Clean up
git branch -d feature/price-tracker
git push origin --delete feature/price-tracker
```

## ⚠️ Important Notes

- **Never work directly on main** - Always use feature branches
- **Pull before merging** - Ensure you have latest main
- **Use feature branches** - Isolated work prevents conflicts
- **Delete old branches** - Keep repository clean

## 📖 Related Documentation

- `.git-workflow.md` - This file (concise reference)
- `TEAM_ONBOARDING.md` - Full onboarding guide
- `TEAM_WORKFLOW.md` - Detailed workflow documentation
