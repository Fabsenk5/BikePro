# Contributing to BikePro

Thank you for your interest in BikePro! 🚵

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/BikePro.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/my-feature`
5. Start the dev server: `npm run web`

## Development Guidelines

### Code Style

- **TypeScript** — all new files must be `.tsx` or `.ts`
- **Functional components** with React hooks
- **Theme constants** — use `theme.colors.*` and `theme.spacing.*` from `constants/Colors.ts`
- **Shared UI components** — use `BPCard`, `BPButton`, `BPSlider`, etc. from `components/ui/`

### Adding a New Feature

1. Create an agent manifest in `.agents/f{N}_{name}.md`
2. Add the feature to `constants/Features.ts` (set `ready: false` initially)
3. Create the screen in `app/(features)/{feature-slug}.tsx`
4. Use `AsyncStorage` via `lib/supabase.ts` helpers for data persistence
5. Set `ready: true` in `Features.ts` when complete

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new component type to Shred-Check
fix: pressure calculation for mullet setups
docs: update README with new features
chore: update dependencies
```

## Pull Requests

1. Ensure `npm run build:web` succeeds without errors
2. Test on web (minimum) — mobile is a bonus
3. Update `CHANGELOG.md` if adding features
4. Keep PRs focused — one feature or fix per PR

## Reporting Issues

- Use GitHub Issues with the appropriate template
- Include: expected behavior, actual behavior, steps to reproduce
- Screenshots are always welcome

## Code of Conduct

Be respectful, constructive, and inclusive. We're all here to make mountain biking more fun. 🤙
