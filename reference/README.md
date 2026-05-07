# VELLUM — The Document OS
### A Lycoris Product

---

## Files

```
vellum/
├── landing/
│   └── index.html        → Marketing landing page
├── product/
│   └── app.html          → Full product application
└── README.md             → This file
```

---

## Design System

**Colors**
- Background: `#0D2018` (Deep Forest Green)
- Surface: `#122819` / `#1A3324`
- Text: `#F5F0E5` (Warm Cream)
- Muted: `#9A9488`
- Danger: `#C87060`
- Success: `#5B9E6F`
- Warning: `#C9A050`

**Typography**
- Display: DM Serif Display (Italic for accents)
- Body: DM Sans (Weight 200–500)

**Design Principles**
- Minimal, editorial aesthetic
- Forest green + cream palette (inspired by luxury document design)
- Pixel grid texture accents
- Clean grid-based layouts
- No gradients — flat, intentional color

---

## Product Features

### Landing Page
- Animated hero with pixel pattern
- Adobe Acrobat kill comparison
- 9-feature showcase grid
- AI intelligence demo mockup
- 3-tier pricing (Free / $7 Pro / $19 Teams)
- Custom cursor, scroll progress bar
- Reveal animations

### Product App
- **Document Sidebar** — upload, search, manage docs
- **PDF Viewer** — real PDF rendering (PDF.js), zoom, page navigation
- **AI Intelligence Tab** — Claude-powered analysis (summary, key points, risk flags, action items)
- **Chat Tab** — live Q&A with documents via Anthropic API
- **Automate Tab** — 6 templates + custom document generation
- **E-Signature Modal** — canvas-based signature drawing
- Drag & drop file upload

---

## Setup

### Landing Page
Open `landing/index.html` in any browser. No build step required.

### Product App
Open `product/app.html` in any browser.

> **Note:** AI features (document analysis, chat, automation) require an Anthropic API key. 
> The app calls `https://api.anthropic.com/v1/messages` directly.
> In production, proxy this through your backend to protect your API key.

---

## Next Steps (Production Build)

1. **Backend** — Next.js + Node.js API routes
2. **Database** — Supabase (Postgres) for document storage
3. **Auth** — Supabase Auth or Clerk
4. **File Storage** — Supabase Storage or AWS S3
5. **E-signature** — DIFC compliance layer
6. **Arabic OCR** — Azure Cognitive Services (Arabic) or Tesseract
7. **Domain** — getvellum.io or vellum.ai

---

*Built by Lycoris · Dubai, UAE*
