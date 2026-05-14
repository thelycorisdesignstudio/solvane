import express from 'express';
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { execFile } from 'child_process';
import { promisify } from 'util';
import Document from '../models/Document.js';
import { auth } from '../middleware/auth.js';
import { mem, mongoReady, id } from '../services/store.js';

const execFileAsync = promisify(execFile);
const r = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads');
const workDir = path.join(process.cwd(), 'tmp', 'advanced-ocr');
fs.mkdirSync(workDir, { recursive: true });
r.use(auth);

async function getDoc(documentId, owner) {
  return mongoReady() ? Document.findOne({ _id: documentId, owner }) : mem.docs.find(d => d.id === documentId && d.owner === owner);
}

function cleanPdfTitle(title = 'document') {
  return String(title || 'document').replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'document';
}

async function savePdf(owner, title, bytes, tags = []) {
  const filename = `${Date.now()}-${cleanPdfTitle(title)}.pdf`;
  fs.writeFileSync(path.join(uploadDir, filename), bytes);
  const data = {
    owner,
    title: cleanPdfTitle(title) + '.pdf',
    originalName: cleanPdfTitle(title) + '.pdf',
    mime: 'application/pdf',
    size: bytes.length,
    path: filename,
    url: `/uploads/${filename}`,
    text: '',
    language: 'auto',
    tags: ['advanced-engine', ...tags],
    transient: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date()
  };
  const doc = mongoReady() ? await Document.create(data) : { id: id(), ...data };
  if (!mongoReady()) mem.docs.push(doc);
  return doc;
}

function lineKey(item) {
  return Math.round(item.y / Math.max(8, item.height || 10));
}

function groupLines(items) {
  const groups = new Map();
  for (const item of items) {
    const key = lineKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()].map(line => {
    const sorted = line.sort((a, b) => a.x - b.x);
    const x = Math.min(...sorted.map(i => i.x));
    const y = Math.min(...sorted.map(i => i.y));
    const right = Math.max(...sorted.map(i => i.x + (i.width || 0)));
    const bottom = Math.max(...sorted.map(i => i.y + (i.height || 10)));
    return {
      id: `p${sorted[0].page}-l${Math.round(y)}`,
      page: sorted[0].page,
      text: sorted.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim(),
      x,
      y,
      width: Math.max(20, right - x),
      height: Math.max(10, bottom - y),
      fontName: sorted[0].fontName || '',
      fontSize: Math.round(sorted.reduce((sum, i) => sum + (i.height || 10), 0) / sorted.length),
      itemIds: sorted.map(i => i.id),
      confidence: 'text-layer-line'
    };
  }).filter(l => l.text).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

function groupParagraphs(lines) {
  const byPage = new Map();
  for (const line of lines) {
    if (!byPage.has(line.page)) byPage.set(line.page, []);
    byPage.get(line.page).push(line);
  }
  const paragraphs = [];
  for (const [page, pageLines] of byPage) {
    const sorted = pageLines.sort((a, b) => a.y - b.y || a.x - b.x);
    let current = [];
    for (const line of sorted) {
      const prev = current[current.length - 1];
      const gap = prev ? line.y - (prev.y + prev.height) : 0;
      const xShift = prev ? Math.abs(line.x - prev.x) : 0;
      if (prev && (gap > Math.max(18, prev.height * 1.8) || xShift > 80)) {
        paragraphs.push(makeParagraph(page, current));
        current = [];
      }
      current.push(line);
    }
    if (current.length) paragraphs.push(makeParagraph(page, current));
  }
  return paragraphs;
}

function makeParagraph(page, lines) {
  const x = Math.min(...lines.map(l => l.x));
  const y = Math.min(...lines.map(l => l.y));
  const right = Math.max(...lines.map(l => l.x + l.width));
  const bottom = Math.max(...lines.map(l => l.y + l.height));
  return {
    id: `p${page}-para-${paragraphHash(lines.map(l => l.id).join('|'))}`,
    page,
    text: lines.map(l => l.text).join('\n'),
    x,
    y,
    width: Math.max(40, right - x),
    height: Math.max(16, bottom - y),
    fontName: lines[0]?.fontName || '',
    fontSize: Math.max(8, Math.round(lines.reduce((sum, l) => sum + (l.fontSize || 10), 0) / lines.length)),
    lineIds: lines.map(l => l.id),
    lineCount: lines.length,
    editableState: lines.length <= 8 ? 'safe-bounded-reflow' : 'inspect-before-edit',
    limitations: ['embedded font reuse depends on PDF internals', 'complex objects/tables require table mode']
  };
}

function paragraphHash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(31, h) + text.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}

function detectTables(lines) {
  const byPage = new Map();
  for (const line of lines) {
    if (!byPage.has(line.page)) byPage.set(line.page, []);
    byPage.get(line.page).push(line);
  }
  const tables = [];
  for (const [page, pageLines] of byPage) {
    const rows = pageLines.filter(l => /\s{2,}|\t|\|/.test(l.text) || (l.text.match(/\b\d+[.,]?\d*\b/g) || []).length >= 2);
    if (rows.length >= 2) {
      const x = Math.min(...rows.map(l => l.x));
      const y = Math.min(...rows.map(l => l.y));
      const right = Math.max(...rows.map(l => l.x + l.width));
      const bottom = Math.max(...rows.map(l => l.y + l.height));
      tables.push({
        id: `p${page}-table-${paragraphHash(rows.map(r => r.text).join('|'))}`,
        page,
        x,
        y,
        width: right - x,
        height: bottom - y,
        rows: rows.map(r => ({ id: r.id, text: r.text, x: r.x, y: r.y, width: r.width })),
        status: 'detected-for-inspection',
        editing: 'not-enabled-until-cell-grid-is-confirmed'
      });
    }
  }
  return tables;
}

async function extractTextBlocks(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjs.getDocument({ data, disableWorker: true });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.map((it, idx) => {
      const tx = it.transform || [1, 0, 0, 1, 0, 0];
      const x = tx[4];
      const y = viewport.height - tx[5];
      return {
        id: `p${p}-t${idx}`,
        page: p,
        text: String(it.str || ''),
        x,
        y,
        width: it.width || 0,
        height: Math.abs(tx[3] || 10),
        fontName: it.fontName || '',
        fontSize: Math.abs(tx[3] || 10),
        confidence: it.str ? 'text-layer' : 'empty'
      };
    }).filter(i => i.text.trim());
    const lines = groupLines(items);
    pages.push({ page: p, width: viewport.width, height: viewport.height, items, lines });
  }
  const allLines = pages.flatMap(p => p.lines);
  return { pageCount: pdf.numPages, pages, paragraphs: groupParagraphs(allLines), tables: detectTables(allLines) };
}

async function commandAvailable(cmd) {
  try { await execFileAsync('which', [cmd]); return true; } catch { return false; }
}

async function ocrToolStatus() {
  const [pdftoppm, tesseract, ocrmypdf] = await Promise.all(['pdftoppm', 'tesseract', 'ocrmypdf'].map(commandAvailable));
  return { pdftoppm, tesseract, ocrmypdf };
}

function parseTsv(tsv, page, scale = 1) {
  const lines = String(tsv || '').trim().split('\n');
  const header = lines.shift()?.split('\t') || [];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  return lines.map((line, n) => {
    const c = line.split('\t');
    const text = c[idx.text] || '';
    const conf = Number(c[idx.conf] || -1);
    return {
      id: `ocr-p${page}-${n}`,
      page,
      text,
      confidence: conf,
      x: Number(c[idx.left] || 0) / scale,
      y: Number(c[idx.top] || 0) / scale,
      width: Number(c[idx.width] || 0) / scale,
      height: Number(c[idx.height] || 0) / scale,
      sourceUnits: 'pdf-top-left',
      level: Number(c[idx.level] || 0)
    };
  }).filter(w => w.text.trim() && w.confidence >= 0);
}

async function saveDocAdvanced(documentId, owner, patch) {
  if (mongoReady()) {
    return Document.findOneAndUpdate({ _id: documentId, owner }, patch, { new: true });
  }
  const d = mem.docs.find(x => x.id === documentId && x.owner === owner);
  if (d) Object.assign(d, patch.$set || {}, patch);
  return d;
}

async function runPageOcr(pdfPath, page = 1, lang = 'eng') {
  const tools = await ocrToolStatus();
  if (!tools.pdftoppm || !tools.tesseract) {
    const missing = [!tools.pdftoppm && 'pdftoppm', !tools.tesseract && 'tesseract'].filter(Boolean);
    const err = new Error(`OCR tools missing: ${missing.join(', ')}`);
    err.status = 501;
    throw err;
  }
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dpi = 180;
  const scale = dpi / 72;
  const outPrefix = path.join(workDir, `page-${stamp}`);
  await execFileAsync('pdftoppm', ['-f', String(page), '-l', String(page), '-r', String(dpi), '-png', pdfPath, outPrefix], { timeout: 30000 });
  const image = `${outPrefix}-${String(page).padStart(1, '0')}.png`;
  const fallbackImage = `${outPrefix}-1.png`;
  const imagePath = fs.existsSync(image) ? image : fallbackImage;
  if (!fs.existsSync(imagePath)) throw new Error('PDF rasterization did not produce an image');
  const tsvBase = path.join(workDir, `ocr-${stamp}`);
  await execFileAsync('tesseract', [imagePath, tsvBase, '-l', lang, 'tsv'], { timeout: 60000 });
  const tsv = fs.readFileSync(`${tsvBase}.tsv`, 'utf8');
  const words = parseTsv(tsv, page, scale);
  const text = words.map(w => w.text).join(' ').replace(/\s+/g, ' ').trim();
  const avgConfidence = words.length ? Math.round(words.reduce((s, w) => s + w.confidence, 0) / words.length) : 0;
  for (const file of [imagePath, `${tsvBase}.tsv`]) fs.rm(file, { force: true }, () => {});
  return { page, lang, dpi, scale, coordinateSystem: 'pdf-top-left', words, text, avgConfidence, wordCount: words.length };
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth || !line) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

async function overlayText(doc, sourcePath, block, text, { reflow = false } = {}) {
  const pdf = await PDFDocument.load(fs.readFileSync(sourcePath));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pageIndex = Math.max(0, Number(block.page || 1) - 1);
  const pg = pdf.getPage(pageIndex);
  const pageHeight = pg.getHeight();
  const x = Number(block.x || 72);
  const y = pageHeight - Number(block.y || 720) - Number(block.height || 24);
  const width = Math.max(20, Number(block.width || 260));
  const height = Math.max(12, Number(block.height || 24));
  const fontSize = Math.max(7, Math.min(24, Number(block.fontSize || 11)));
  pg.drawRectangle({ x, y, width, height: height + 4, color: rgb(1, 1, 1), opacity: 1 });
  const lines = reflow ? wrapText(text, font, fontSize, width) : String(text).split('\n');
  const lineHeight = fontSize * 1.25;
  const maxLines = Math.max(1, Math.floor(height / lineHeight));
  const drawn = lines.slice(0, maxLines);
  drawn.forEach((line, idx) => pg.drawText(line.slice(0, 240), { x, y: y + height - fontSize - (idx * lineHeight), size: fontSize, font, color: rgb(0.05, 0.05, 0.05), maxWidth: width }));
  return { bytes: await pdf.save(), overflow: lines.length > maxLines, lines: lines.length, drawn: drawn.length };
}

async function overlayRedaction(sourcePath, block) {
  const pdf = await PDFDocument.load(fs.readFileSync(sourcePath));
  const pageIndex = Math.max(0, Number(block.page || 1) - 1);
  const pg = pdf.getPage(pageIndex);
  const pageHeight = pg.getHeight();
  const x = Number(block.x || 72);
  const y = pageHeight - Number(block.y || 720) - Number(block.height || 24);
  const width = Math.max(8, Number(block.width || 180));
  const height = Math.max(8, Number(block.height || 24));
  pg.drawRectangle({ x, y, width, height, color: rgb(0, 0, 0), opacity: 1 });
  return pdf.save();
}

r.get('/:id/text-blocks', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  try {
    const blocks = await extractTextBlocks(path.join(uploadDir, d.path));
    res.json({ documentId: req.params.id, editable: blocks.pages.some(p => p.items.length), mode: 'text-layer-inspection', blocks });
  } catch (e) { res.status(500).json({ error: 'Text block extraction failed', detail: e.message }); }
});

r.get('/:id/paragraphs', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  try {
    const blocks = await extractTextBlocks(path.join(uploadDir, d.path));
    res.json({ documentId: req.params.id, paragraphs: blocks.paragraphs, tables: blocks.tables, note: 'Paragraphs are inferred from PDF text geometry. Complex PDFs require inspection before editing.' });
  } catch (e) { res.status(500).json({ error: 'Paragraph inspection failed', detail: e.message }); }
});

r.post('/:id/replace-block', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  const { text = 'Replacement text', reflow = false, ...block } = req.body || {};
  try {
    const result = await overlayText(d, path.join(uploadDir, d.path), block, text, { reflow });
    res.json({
      document: await savePdf(req.user.id, `${d.title || 'document'}-${reflow ? 'reflow-edited' : 'text-edited'}`, result.bytes, [reflow ? 'bounded-reflow' : 'text-replace']),
      engine: { mode: reflow ? 'bounded-paragraph-reflow' : 'safe-block-replacement', overflow: result.overflow, lines: result.lines, drawn: result.drawn },
      warning: result.overflow ? 'Text overflowed the selected block. Review output before use.' : 'Edited PDF version created while preserving the original.'
    });
  } catch (e) { res.status(500).json({ error: 'Text replacement failed', detail: e.message }); }
});

r.post('/:id/reflow-paragraph', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  const { text = 'Replacement text', ...block } = req.body || {};
  try {
    const result = await overlayText(d, path.join(uploadDir, d.path), block, text, { reflow: true });
    res.json({
      document: await savePdf(req.user.id, `${d.title || 'document'}-reflow-edited`, result.bytes, ['bounded-reflow']),
      engine: { mode: 'bounded-paragraph-reflow', overflow: result.overflow, lines: result.lines, drawn: result.drawn },
      warning: result.overflow ? 'Text overflowed the paragraph box. Review output before use.' : 'Bounded paragraph reflow version created while preserving the original.'
    });
  } catch (e) { res.status(500).json({ error: 'Paragraph reflow failed', detail: e.message }); }
});

r.post('/:id/redact-block', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  try {
    res.json({
      document: await savePdf(req.user.id, `${d.title || 'document'}-redacted-block`, await overlayRedaction(path.join(uploadDir, d.path), req.body || {}), ['redacted-block']),
      engine: { mode: 'ocr-or-text-block-redaction', coordinateSystem: 'pdf-top-left' },
      warning: 'Redaction was burned into a new PDF version. Review output before sharing.'
    });
  } catch (e) { res.status(500).json({ error: 'Block redaction failed', detail: e.message }); }
});

r.get('/:id/tables', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  try {
    const blocks = await extractTextBlocks(path.join(uploadDir, d.path));
    res.json({ documentId: req.params.id, tables: blocks.tables, note: 'Table editing is inspection-only until cell grid confirmation is implemented.' });
  } catch (e) { res.status(500).json({ error: 'Table inspection failed', detail: e.message }); }
});

r.get('/:id/ocr-status', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  let textLayer = false, pageCount = 0;
  try { const b = await extractTextBlocks(path.join(uploadDir, d.path)); textLayer = b.pages.some(p => p.items.length > 0); pageCount = b.pageCount; } catch {}
  const tools = await ocrToolStatus();
  res.json({
    documentId: req.params.id,
    pageCount,
    textLayer,
    ocrEngine: tools.tesseract ? 'system-tesseract' : 'not-installed',
    rasterEngine: tools.pdftoppm ? 'poppler-pdftoppm' : 'not-installed',
    searchablePdfEngine: tools.ocrmypdf ? 'ocrmypdf' : 'not-installed',
    tools,
    advancedOcrEditing: tools.tesseract && tools.pdftoppm ? 'runnable-page-ocr-with-editable-word-boxes' : 'foundation-ready-needs-host-tools',
    supportedNow: ['detect text layer', 'extract positioned text blocks', 'infer paragraphs', 'bounded paragraph reflow overlay', 'inspect table-like regions', 'rasterize and OCR individual pages when host tools exist', 'convert OCR word boxes into PDF coordinates', 'redact OCR/text blocks', 'replace OCR/text blocks with overlay text'],
    nextRequired: ['searchable PDF text-layer writing', 'cell-grid table editor', 'font-aware scanned document reconstruction'],
    notFaked: ['font-subset rewriting', 'unbounded Word-style document reflow', 'verified OCR correction without an OCR run']
  });
});

r.post('/:id/ocr-page', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  const page = Math.max(1, Math.min(25, Number(req.body?.page || 1)));
  const lang = String(req.body?.lang || 'eng').replace(/[^a-zA-Z_+]/g, '').slice(0, 24) || 'eng';
  try {
    const result = await runPageOcr(path.join(uploadDir, d.path), page, lang);
    if (mongoReady()) await Document.updateOne({ _id: req.params.id, owner: req.user.id }, { $push: { 'advanced.ocrRuns': { page, lang, avgConfidence: result.avgConfidence, wordCount: result.wordCount, text: result.text } }, $set: { text: result.text } });
    else { d.advanced = d.advanced || {}; d.advanced.ocrRuns = [...(d.advanced.ocrRuns || []), { page, lang, avgConfidence: result.avgConfidence, wordCount: result.wordCount, text: result.text, createdAt: new Date() }]; d.text = result.text; }
    res.json({ documentId: req.params.id, result, note: 'OCR page run complete and saved. Review low-confidence words before applying corrections.' });
  } catch (e) { res.status(e.status || 500).json({ error: 'OCR page run failed', detail: e.message }); }
});

r.post('/:id/ocr-corrections', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  const corrections = (Array.isArray(req.body?.corrections) ? req.body.corrections : []).map((c, index) => ({
    page: Number(c.page || 1), from: String(c.from || '').slice(0, 500), to: String(c.to || '').slice(0, 500), confidence: String(c.confidence || 'manual-review'), createdAt: new Date(), id: c.id || `correction-${index + 1}`
  }));
  if (mongoReady()) await Document.updateOne({ _id: req.params.id, owner: req.user.id }, { $push: { 'advanced.ocrCorrections': { $each: corrections } } });
  else { d.advanced = d.advanced || {}; d.advanced.ocrCorrections = [...(d.advanced.ocrCorrections || []), ...corrections]; }
  res.json({ documentId: req.params.id, accepted: corrections, note: 'OCR corrections persisted. Use searchable PDF generation to write an OCR text layer.' });
});

r.post('/:id/searchable-pdf', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  const tools = await ocrToolStatus();
  if (!tools.ocrmypdf) return res.status(501).json({ error: 'Searchable PDF engine unavailable', detail: 'ocrmypdf is not installed on this host' });
  const lang = String(req.body?.lang || 'eng').replace(/[^a-zA-Z_+]/g, '').slice(0, 24) || 'eng';
  const deskew = req.body?.deskew !== false;
  const input = path.join(uploadDir, d.path);
  const outputName = `${Date.now()}-${cleanPdfTitle(d.title || 'document')}-searchable.pdf`;
  const output = path.join(uploadDir, outputName);
  try {
    const args = ['--skip-text', '-l', lang, '--optimize', '1'];
    if (deskew) args.push('--deskew');
    args.push(input, output);
    await execFileAsync('ocrmypdf', args, { timeout: 180000 });
    const bytes = fs.readFileSync(output);
    const doc = await savePdf(req.user.id, `${d.title || 'document'}-searchable`, bytes, ['ocr-searchable']);
    fs.rm(output, { force: true }, () => {});
    res.json({ document: doc, engine: { mode: 'searchable-ocr-pdf', lang, deskew, tool: 'ocrmypdf' }, note: 'Searchable OCR PDF created as a new version while preserving the original.' });
  } catch (e) {
    fs.rm(output, { force: true }, () => {});
    res.status(500).json({ error: 'Searchable PDF generation failed', detail: e.stderr || e.message });
  }
});

export default r;
