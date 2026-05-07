# Solvane — The Document OS

Solvane is an open-source, browser-first PDF and document operating system built by **The Lycoris Labs** for **The Lycoris Foundation** from **Dubai, United Arab Emirates**.

Our goal is simple: powerful document tools should be available to everyone. PDFs carry contracts, invoices, education, public policy, research, opportunity, and identity. Solvane exists so people, students, founders, nonprofits, agencies, teams, and institutions can work with documents without being locked behind expensive software.

## Open-source commitment

Solvane is released under the MIT License. The code is public so the community can inspect it, improve it, self-host it, adapt it for local needs, and help build document infrastructure for the better of humanity.

## What Solvane does today

- Upload and manage PDFs
- View PDFs in the browser
- Add/remove/extract pages
- Rearrange pages
- Rotate and crop pages
- Highlight, underline, and strike-through
- Add notes/comments
- Add text boxes
- Redact basic content with burn-in boxes
- Draw/sign documents with signature evidence
- Fill visible form text
- Watermark and stamp PDFs
- Merge PDFs API
- Export text from embedded PDF text
- Export PDF pages to images
- Create PDFs from images API
- Compress/optimize PDF object streams
- Encrypt/decrypt PDFs with host tooling
- Web-optimize/linearize PDFs
- Share documents with tokenized links
- Team workspace groundwork
- Audit/protection metadata
- 150+ language product direction with RTL/LTR support

## What we do not fake

Advanced PDF editing is hard. Solvane does not falsely claim perfect support for:

- True paragraph-level inline editing of arbitrary existing PDF text
- Professional reflow of complex PDF layouts
- Advanced OCR editing for scanned PDFs without configured OCR engines
- Complex table reconstruction from PDFs
- Enterprise policy workflows without deployment configuration

These are long-term engine goals, not fake UI claims.

## Tech stack

- React + Vite frontend
- Express backend
- MongoDB + Mongoose
- PDF operations via `pdf-lib`, `qpdf`, and `poppler-utils` where available
- JWT authentication
- MIT License

## Local development

```bash
npm install
npm --prefix client install
npm --prefix server install
cp server/.env.example server/.env
npm run dev
```

## Environment

```env
PORT=8081
MONGO_URI=mongodb://127.0.0.1:27017/solvane
JWT_SECRET=change-me
CORS_ORIGINS=http://localhost:5173
```

## Security

See [SECURITY.md](./SECURITY.md). Never commit secrets, uploads, `.env` files, private PDFs, database dumps, or deployment credentials.

## License

MIT. See [LICENSE](./LICENSE).

## From

Built in Dubai, United Arab Emirates by The Lycoris Labs for The Lycoris Foundation.
