# VELLUM - The Document OS

An original open-source MERN PDF/document platform by Lycoris. It uses the provided VELLUM landing identity and builds a usable web app: auth, PDF uploads, workspace, backend-only AI endpoints, Arabic/RTL UI, document automation, and e-signature evidence capture.

This is not reverse-engineered Adobe Acrobat and does not bypass licenses, DRM, signatures, activation, or proprietary protections.

## Stack
- React + Vite client
- Express API
- MongoDB/Mongoose with local in-memory fallback for development only
- JWT auth + bcrypt
- Multer PDF uploads

## Setup
```bash
npm install
npm --prefix client install
npm --prefix server install
cp server/.env.example server/.env
npm run dev
```

## Environment
`server/.env.example`:
```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/vellum
JWT_SECRET=change-me
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## APIs
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/documents`
- `POST /api/documents` multipart PDF upload
- `GET /api/documents/:id`
- `DELETE /api/documents/:id`
- `POST /api/ai/analyze/:id`
- `POST /api/ai/chat/:id`
- `GET /api/automation/templates`
- `POST /api/automation/generate`
- `GET /api/signatures/:documentId`
- `POST /api/signatures/:documentId`

## Notes
AI endpoints currently include deterministic local fallback so the app remains useful without vendor keys. Add OpenAI/Anthropic/Azure providers in `server/routes/ai.js` and keep all keys backend-only.

## Live deployment

Current hosted build: https://vellum.thelycoris.com

Production service on Jarvis VM:
- Frontend: `/var/www/vellum`
- Backend: `vellum-backend.service` on port `8081`
- Nginx site: `vellum.thelycoris.com`
- MongoDB database: `vellum`

