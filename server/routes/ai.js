import express from 'express';
import Document from '../models/Document.js';
import { auth } from '../middleware/auth.js';
import { mem, mongoReady } from '../services/store.js';

const r = express.Router();
r.use(auth);

const STOP = new Set('a,an,and,are,as,at,be,by,for,from,has,have,in,is,it,its,of,on,or,that,the,their,this,to,with,will,you,your,we,our,shall,may,can,not'.split(','));
const RISK_RULES = [
  ['payment', /\b(payment|invoice|fee|amount|price|late|interest|penalt)/i, 'Payment obligations or penalties need review.'],
  ['termination', /\b(terminate|termination|cancel|breach|default|notice period)/i, 'Termination and default rights need review.'],
  ['liability', /\b(liability|indemn|damages|warranty|limitation|hold harmless)/i, 'Liability, indemnity, warranty, or damages language appears.'],
  ['privacy', /\b(confidential|privacy|personal data|data protection|gdpr|security)/i, 'Confidentiality or data-protection language appears.'],
  ['jurisdiction', /\b(governing law|jurisdiction|venue|arbitration|dispute)/i, 'Dispute, law, venue, or arbitration clauses need review.'],
  ['signature', /\b(signature|signed|authorized representative|counterpart)/i, 'Signature authority or execution language appears.'],
  ['deadline', /\b(deadline|due date|expires?|renewal|within \d+ days|\d+\s+business days)/i, 'Deadlines, expiry, or renewal obligations appear.']
];

async function getDoc(id, owner) {
  return mongoReady() ? Document.findOne({ _id: id, owner }) : mem.docs.find(x => x.id === id && x.owner === owner);
}

function sentences(text) {
  return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?؟])\s+/).map(s => s.trim()).filter(Boolean);
}

function words(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]{1,}/g) || [];
}

function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function keywords(text) {
  const counts = new Map();
  for (const w of words(text)) {
    if (STOP.has(w) || w.length < 3) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 14)
    .map(([term, count]) => ({ term, count }));
}

function entities(text) {
  const source = String(text || '');
  const money = [...source.matchAll(/(?:USD|AED|EUR|GBP|\$|€|£)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:USD|AED|EUR|GBP)/gi)].map(m => m[0]);
  const dates = [...source.matchAll(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}|\d{1,2}\s+(?:business\s+)?days?)\b/gi)].map(m => m[0]);
  const emails = [...source.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(m => m[0]);
  const organizations = [...source.matchAll(/\b(?:[A-Z][A-Za-z0-9&.-]+\s){1,4}(?:LLC|Ltd|Limited|Inc|Corp|Corporation|Foundation|Labs|Studio|FZE|LLP)\b/g)].map(m => m[0].trim());
  return {
    money: [...new Set(money)].slice(0, 12),
    dates: [...new Set(dates)].slice(0, 12),
    emails: [...new Set(emails)].slice(0, 8),
    organizations: [...new Set(organizations)].slice(0, 8)
  };
}

function risks(text) {
  const hits = [];
  for (const [id, pattern, message] of RISK_RULES) {
    if (pattern.test(text)) hits.push({ id, severity: ['liability', 'jurisdiction', 'privacy'].includes(id) ? 'high' : 'medium', message });
  }
  if (!hits.length) hits.push({ id: 'general-review', severity: 'low', message: 'No obvious clause risk keywords found, but manual review is still required.' });
  return hits;
}

function readability(text, ws, ss) {
  const syllableEstimate = ws.reduce((sum, w) => sum + Math.max(1, (w.match(/[aeiouy]+/gi) || []).length), 0);
  const wordsPerSentence = ss.length ? ws.length / ss.length : ws.length;
  const syllablesPerWord = ws.length ? syllableEstimate / ws.length : 0;
  const flesch = Math.round(206.835 - (1.015 * wordsPerSentence) - (84.6 * syllablesPerWord));
  return { wordsPerSentence: Math.round(wordsPerSentence * 10) / 10, estimatedFlesch: Math.max(0, Math.min(100, flesch)) };
}

function localAnalyze(t) {
  const text = String(t || '');
  const ss = sentences(text);
  const ws = words(text);
  const keys = keywords(text);
  const ents = entities(text);
  const riskObjects = risks(text);
  const score = Math.max(0, Math.min(100, 92 - riskObjects.filter(r => r.severity === 'high').length * 14 - riskObjects.filter(r => r.severity === 'medium').length * 7 + Math.min(8, keys.length)));
  const summary = ss.slice(0, 3).join(' ') || 'No extractable text found. Upload a text-based PDF for deeper analysis.';
  const actionItems = [
    ...riskObjects.slice(0, 4).map(r => `Review ${r.id.replace('-', ' ')}: ${r.message}`),
    ents.dates.length ? 'Confirm every detected date, renewal, expiry, and notice period.' : 'Add or confirm key dates if this document creates obligations.',
    ents.money.length ? 'Confirm all detected amounts, currencies, fees, penalties, and totals.' : 'Confirm whether monetary obligations are missing or implied.'
  ];
  return {
    provider: 'local-deterministic-engine',
    fallback: true,
    summary,
    keyPoints: ss.slice(0, 5),
    keywords: keys,
    entities: ents,
    riskFlags: riskObjects.map(r => `${titleCase(r.severity)}: ${r.message}`),
    riskModel: { score, risks: riskObjects },
    actionItems,
    readability: readability(text, ws, ss),
    stats: { words: ws.length, sentences: ss.length, characters: text.length },
    confidence: text.length > 500 ? 'medium-high' : text.length ? 'medium' : 'low'
  };
}

r.post('/analyze/:id', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  res.json({ analysis: localAnalyze(d.text), documentId: req.params.id });
});

r.post('/chat/:id', async (req, res) => {
  const d = await getDoc(req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Document not found' });
  const q = String(req.body.message || '').toLowerCase();
  const qWords = words(q).filter(w => !STOP.has(w));
  const ranked = sentences(d.text).map(s => {
    const lower = s.toLowerCase();
    const score = qWords.reduce((sum, w) => sum + (lower.includes(w) ? 1 : 0), 0);
    return { sentence: s, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  res.json({
    fallback: true,
    answer: ranked.length
      ? `Relevant excerpt: ${ranked.slice(0, 2).map(x => x.sentence).join(' ')}`
      : 'I could not find a direct match in extracted text. Try asking about parties, dates, obligations, risks, payment, termination, or upload an OCR/text PDF.',
    matches: ranked.slice(0, 5)
  });
});

export default r;
