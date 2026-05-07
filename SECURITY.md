# Security Policy

Solvane is intended to be public, inspectable document infrastructure. Security matters because users may upload sensitive PDFs.

## Supported disclosure path

Please report vulnerabilities privately to: hello@thelycoris.com

Do not open public issues for active vulnerabilities that expose user data.

## Data handling principles

- Keep secrets out of the repository.
- Use environment variables for deployment secrets.
- Do not commit uploaded documents.
- Do not commit `.env` files.
- Do not commit database dumps.
- Do not send user PDFs to third-party AI services by default.
- Prefer local/server-side PDF tooling for document operations.

## Current safeguards

- JWT authentication.
- Password hashing with bcrypt.
- Helmet security headers.
- CORS allowlist support.
- Upload type and size checks.
- Server-side PDF operations.
- Public share links use random tokens.
- Open-source repository excludes uploads, env files, build artifacts, and dependencies.

## Deployment checklist

Before any production deployment:

1. Set `JWT_SECRET` to a strong random value.
2. Set `MONGO_URI` outside the repository.
3. Configure `CORS_ORIGINS` to trusted domains only.
4. Serve over HTTPS.
5. Keep `/server/uploads` backed up and protected.
6. Rotate secrets if accidentally exposed.
7. Review dependencies with `npm audit`.
