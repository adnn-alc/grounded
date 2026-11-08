# Contributing to Grounded

Thanks for wanting to help! Grounded is a small hobby project run by one person, so issues and pull requests are reviewed when there's time. Small, focused changes get merged fastest.

## Ways to help

- **Report a bug:** open an issue with the bug template. Say what you did, what you expected and what happened, plus your Grounded version (sidebar or Settings → About).
- **Suggest a feature:** open an issue with the feature template. Describe the problem you want solved, not just the solution.
- **Send a pull request:** for anything bigger than a small fix, open an issue first so we can agree on the approach before you spend time on it.
- **Security problems:** please don't open a public issue. See [SECURITY.md](SECURITY.md).

## Running it locally

You need Node 22.18 or newer (Node 24 recommended; the tests need 24).

```bash
npm install
npm run dev
```

The UI runs on http://localhost:5173 and the API on http://localhost:3001. The dev database is created at `data/grounded.db` with some sample data. See the [README](README.md#local-development) for more.

## Before you open a pull request

Run the same checks CI runs:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

And please:

- **Keep it focused:** one change per pull request, without unrelated reformatting.
- **Follow the existing style:** TypeScript with strict mode; plain CSS with the theme variables in `src/styles/global.css` (use `var(--font-mono)` and friends, never a hard-coded font or color); no new UI libraries without discussing it first.
- **Database changes** need a new numbered migration in `server/db.ts`, plus the matching change in the `CREATE TABLE` block and in `src/types.ts`. Never edit an existing migration. A test in `server/migrations.test.ts` is very welcome.
- **API changes** need validation in `server/validation.ts` and, ideally, a test in `server/api.test.ts`.
- **User-facing changes** get a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md).

[CLAUDE.md](CLAUDE.md) has a fuller tour of how the code fits together.

## License

Grounded is licensed under the [GNU AGPL v3.0 or later](LICENSE). By contributing, you agree that your contributions are licensed under the same terms.

## Code of conduct

Please be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
