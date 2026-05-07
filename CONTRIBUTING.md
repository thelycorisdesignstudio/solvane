# Contributing to Solvane

Thank you for helping build document infrastructure for the world.

## Mission

Solvane is built by The Lycoris Labs for The Lycoris Foundation from Dubai, United Arab Emirates. The goal is to make powerful document tools free, open, inspectable, and useful for people everywhere.

## Standards

- Keep user data private.
- Do not commit secrets, uploaded files, or generated documents.
- Keep features honest: do not claim unsupported PDF/OCR capabilities.
- Prefer accessible, responsive UI.
- Add tests or clear smoke checks for backend routes.
- Keep dependencies minimal and maintained.

## Local setup

```bash
npm install
npm --prefix client install
npm --prefix server install
cp server/.env.example server/.env
npm run dev
```
