# Solvane Open Source Standards

Solvane is public document infrastructure. The repository must be safe, useful, and honest.

## Security rules

- Never commit `.env` files.
- Never commit API keys, OAuth secrets, tokens, private certificates, or signing keys.
- Never commit uploaded PDFs or user data.
- Never commit database dumps.
- Never expose AI/OCR provider keys in frontend code.
- Keep generated files out of version control unless they are documentation artifacts.
- Run a secret scan before public release commits.

## Product honesty rules

- Label working features as working.
- Label roadmap features as roadmap.
- Do not claim arbitrary PDF text editing until the engine safely supports it.
- Do not claim advanced OCR editing unless OCR engine configuration is present.
- Do not claim enterprise workflows unless deployment configuration exists.

## Engineering rules

- Preserve original PDFs; all edits create a new version.
- Use deterministic filenames that do not endlessly append suffixes.
- Backend endpoints must return clear errors.
- Frontend must show real output links for generated files.
- Mobile UI must be first-class.
- Accessibility must include visible focus states and readable contrast.

## Documentation rules

Every major feature should document:

- what it does
- what it does not do
- required dependencies
- setup steps
- verification steps
- known limitations

## Contribution rules

- Keep PRs scoped.
- Include screenshots for UI work.
- Include API smoke tests for backend tools.
- Update README/docs when feature behavior changes.
- Prefer open standards and open-source dependencies.
