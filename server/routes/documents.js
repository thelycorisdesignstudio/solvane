import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import Document from '../models/Document.js';
import { auth } from '../middleware/auth.js';
import { mem, mongoReady, id } from '../services/store.js';

const r = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'))
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || (file.originalname || '').toLowerCase().endsWith('.pdf');
    return ok ? cb(null, true) : cb(new Error('Only PDF uploads are allowed'));
  }
});

async function extractPdfText(filePath) {
  const bytes = fs.readFileSync(filePath);
  try {
    const parsed = await pdf(bytes);
    if (parsed.text?.trim()) return parsed.text;
  } catch {}
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true });
    const doc = await loadingTask.promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      pages.push(content.items.map(i => i.str || '').join(' ').replace(/\s+/g, ' ').trim());
    }
    return pages.filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

async function cleanupTransient(owner) {
  const filter = { owner, transient: true };
  const docs = mongoReady() ? await Document.find(filter) : mem.docs.filter(d => d.owner === owner && d.transient);
  for (const d of docs) {
    const file = d.path && path.join(uploadDir, d.path);
    if (file && file.startsWith(uploadDir)) fs.rm(file, { force: true }, () => {});
  }
  if (mongoReady()) await Document.deleteMany(filter);
  else mem.docs = mem.docs.filter(d => !(d.owner === owner && d.transient));
  return docs.length;
}

r.use(auth);

r.post('/session/clear', async (req, res) => {
  const cleared = await cleanupTransient(req.user.id);
  res.json({ ok: true, cleared, note: 'Transient workspace uploads cleared.' });
});

r.get('/', async (req, res) => {
  const owner = req.user.id;
  if (req.query.clearTransient === 'true') await cleanupTransient(owner);
  if (req.query.includeLibrary !== 'true') return res.json({ documents: [], note: 'Solvane does not show or retain an upload library by default. Use the current upload only.' });
  const filter = { owner, transient: { $ne: true } };
  const docs = mongoReady() ? await Document.find(filter).sort({ createdAt: -1 }) : mem.docs.filter(d => d.owner === owner && !d.transient).sort((a, b) => b.createdAt - a.createdAt);
  res.json({ documents: docs.map(d => {
    const o = d.toObject ? d.toObject() : d;
    return { ...o, absoluteUrl: `${req.protocol}://${req.get('host')}${o.url}` };
  }) });
});

r.post('/', upload.single('file'), async (req, res) => {
  await cleanupTransient(req.user.id);
  const text = (await extractPdfText(req.file.path)).slice(0, 20000);
  const data = {
    owner: req.user.id,
    title: req.body.title || req.file.originalname,
    originalName: req.file.originalname,
    mime: req.file.mimetype,
    size: req.file.size,
    path: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    text,
    language: req.body.language || 'auto',
    tags: (req.body.tags || '').split(',').filter(Boolean),
    transient: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date()
  };
  const doc = mongoReady() ? await Document.create(data) : { id: id(), ...data };
  if (!mongoReady()) mem.docs.push(doc);
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.absoluteUrl = `${req.protocol}://${req.get('host')}${obj.url}`;
  res.json({ document: obj, extraction: { characters: text.length, engine: text ? 'pdf-text-layer' : 'none' } });
});

r.get('/:id', async (req, res) => {
  const d = mongoReady() ? await Document.findOne({ _id: req.params.id, owner: req.user.id }) : mem.docs.find(x => x.id === req.params.id && x.owner === req.user.id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  const o = d.toObject ? d.toObject() : d;
  res.json({ document: { ...o, absoluteUrl: `${req.protocol}://${req.get('host')}${o.url}` } });
});

r.delete('/:id', async (req, res) => {
  if (mongoReady()) await Document.deleteOne({ _id: req.params.id, owner: req.user.id });
  else mem.docs = mem.docs.filter(x => x.id !== req.params.id);
  res.json({ ok: true });
});

export default r;
