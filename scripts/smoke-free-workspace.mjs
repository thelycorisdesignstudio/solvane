import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFDocument, StandardFonts, rgb } = require('../server/node_modules/pdf-lib');

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8081/api';
const SESSION = process.env.SMOKE_SESSION || `smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const jsonHeaders = { 'Content-Type': 'application/json' };
const createdDocumentIds = new Set();
const results = [];

async function request(path, options = {}, allowed = [200]) {
  options.headers = { 'X-Solvane-Session': SESSION, ...(options.headers || {}) };
  const res = await fetch(BASE + path, options);
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : await res.text().then(text => ({ text })).catch(() => ({}));
  if (!allowed.includes(res.status)) {
    throw new Error(`${path} -> ${res.status} ${data.error || data.text || ''}${data.detail ? `: ${data.detail}` : ''}`);
  }
  return { status: res.status, data };
}

function docId(doc) {
  return doc?._id || doc?.id;
}

function remember(doc) {
  const id = docId(doc);
  if (id) createdDocumentIds.add(id);
  return doc;
}

async function check(name, fn) {
  const started = Date.now();
  const out = await fn();
  results.push({ name, ms: Date.now() - started, status: out?.status || 200 });
  return out?.data || out;
}

async function makePdf(title = 'Solvane Smoke') {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage([595, 842]);
  first.drawText(`${title} contract. Payment of USD 1200 is due June 1, 2026. Termination requires 30 days written notice. Liability is limited by governing law. Confidential information must be protected.`, {
    x: 72,
    y: 720,
    size: 12,
    font,
    color: rgb(0, 0, 0),
    maxWidth: 470
  });
  const second = pdf.addPage([595, 842]);
  second.drawText('Second page for organize, extract, reorder, duplicate, crop, rotate, and merge workflows.', {
    x: 72,
    y: 720,
    size: 12,
    font,
    color: rgb(0, 0, 0),
    maxWidth: 470
  });
  return pdf.save();
}

async function uploadPdf(name, bytes) {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: 'application/pdf' }), name);
  const { data } = await request('/documents', { method: 'POST', body: fd });
  remember(data.document);
  if (!data.extraction?.characters) throw new Error(`Expected extracted text for ${name}`);
  return data.document;
}

async function uploadImagePdf() {
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'));
  const fd = new FormData();
  fd.append('images', new Blob([png], { type: 'image/png' }), 'pixel.png');
  fd.append('title', 'pixel.pdf');
  const { data } = await request('/convert/images-to-pdf', { method: 'POST', body: fd });
  remember(data.document);
  return data.document;
}

async function run() {
  await check('health', () => request('/health'));
  await check('capabilities', () => request('/capabilities'));
  await check('clear-session', () => request('/documents/session/clear', { method: 'POST', headers: jsonHeaders, body: '{}' }));

  const pdfBytes = await makePdf();
  const doc = await check('upload-pdf', async () => ({ data: await uploadPdf('solvane-smoke.pdf', pdfBytes) }));
  const id = docId(doc);

  await check('documents-get', () => request(`/documents/${id}`));
  await check('documents-list-library', () => request('/documents?includeLibrary=true'));

  const analysis = await check('ai-analyze', () => request(`/ai/analyze/${id}`, { method: 'POST', headers: jsonHeaders, body: '{}' }));
  if (!analysis.analysis?.keywords?.length) throw new Error('AI analysis did not return keywords.');
  if (!analysis.analysis?.entities?.money?.length) throw new Error('AI analysis did not detect money.');
  await check('ai-chat', () => request(`/ai/chat/${id}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ message: 'payment termination liability' }) }));

  await check('automation-templates', () => request('/automation/templates'));
  await check('automation-generate', () => request('/automation/generate', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ type: 'proposal', title: 'Smoke Proposal' }) }));

  const toolBodies = [
    ['rotate', { angle: 90 }],
    ['crop', { margin: 12, page: 1 }],
    ['extract', { pages: '1' }],
    ['delete-pages', { pages: '2' }],
    ['reorder', { order: '2,1' }],
    ['insert-blank', { afterPage: 1 }],
    ['duplicate-page', { page: 1 }],
    ['watermark', { text: 'SOLVANE' }],
    ['stamp', { text: 'APPROVED', page: 1 }],
    ['annotate', { kind: 'note', text: 'Review this clause', page: 1, x: 72, y: 620 }],
    ['annotate-highlight', { endpoint: 'annotate', body: { kind: 'highlight', page: 1, x: 72, y: 690, width: 220, height: 22 } }],
    ['redact', { page: 1, x: 72, y: 580, width: 180, height: 22 }],
    ['underline', { page: 1, x: 72, y: 560, x2: 260 }],
    ['strike', { page: 1, x: 72, y: 540, x2: 260 }],
    ['textbox', { page: 1, x: 72, y: 500, text: 'Smoke textbox' }],
    ['shape-arrow', { endpoint: 'shape', body: { kind: 'arrow', page: 1, x: 90, y: 480, width: 140, height: 40 } }],
    ['speech-bubble', { page: 1, x: 72, y: 440, text: 'Smoke bubble' }],
    ['bates', { prefix: 'SMK' }],
    ['clean-metadata', {}],
    ['compress', {}]
  ];

  let mergePartnerId = null;
  for (const [name, payload] of toolBodies) {
    const endpoint = payload.endpoint || name;
    const body = payload.body || payload;
    const data = await check(`tools-${name}`, () => request(`/tools/${id}/${endpoint}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) }));
    remember(data.document);
    if (name === 'textbox') mergePartnerId = docId(data.document);
  }

  const merged = await check('tools-merge', () => request('/tools/merge', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ ids: [id, mergePartnerId], title: 'smoke-merged.pdf' })
  }));
  remember(merged.document);

  await check('convert-to-text', () => request(`/convert/${id}/to-text`, { method: 'POST', headers: jsonHeaders, body: '{}' }));
  await check('convert-to-images', () => request(`/convert/${id}/to-images`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ dpi: 72 }) }));
  await check('convert-ocr-status', () => request(`/convert/${id}/ocr-status`, { method: 'POST', headers: jsonHeaders, body: '{}' }));
  await check('convert-images-to-pdf', uploadImagePdf);

  const comment = await check('comments-add', () => request(`/comments/${id}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ text: 'Smoke comment', page: 1 }) }));
  await check('comments-list', () => request(`/comments/${id}`));
  await check('comments-patch', () => request(`/comments/${comment.comment.id || comment.comment._id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ resolved: true, text: 'Resolved smoke comment' }) }));

  await check('protect-save', () => request(`/protect/${id}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ classification: 'Confidential', download: true, copy: true }) }));
  await check('protect-get', () => request(`/protect/${id}`));
  await check('protect-audit', () => request(`/protect/${id}/audit`));

  const share = await check('share-create', () => request(`/share/${id}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ permission: 'view' }) }));
  await check('share-list', () => request(`/share/${id}`));
  await check('share-public', async () => {
    const publicUrl = new URL(share.publicUrl);
    return request(publicUrl.pathname.replace('/api', ''), {}, [200, 302]);
  });

  const team = await check('team-create', () => request('/team', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name: 'Smoke Workspace' }) }));
  await check('team-list', () => request('/team'));
  await check('team-invite', () => request(`/team/${team.team.id || team.team._id}/invite`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'editor@solvane.test', role: 'editor' }) }));

  await check('forms-map', () => request(`/forms/${id}/create-field-map`, { method: 'POST', headers: jsonHeaders, body: '{}' }));
  const filled = await check('forms-fill', () => request(`/forms/${id}/fill`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ fields: [{ name: 'Client', value: 'Solvane', page: 1, x: 72, y: 360 }] }) }));
  remember(filled.document);

  await check('signature-create', () => request(`/signatures/${id}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ signerName: 'Smoke', signerEmail: 'smoke@solvane.local', imageData: 'data:image/png;base64,', timezone: 'UTC', accepted: true }) }));
  await check('signature-list', () => request(`/signatures/${id}`));

  await check('advanced-text-blocks', () => request(`/advanced/${id}/text-blocks`));
  await check('advanced-paragraphs', () => request(`/advanced/${id}/paragraphs`));
  await check('advanced-tables', () => request(`/advanced/${id}/tables`));
  await check('advanced-ocr-status', () => request(`/advanced/${id}/ocr-status`));
  await check('advanced-ocr-page-host-gated', () => request(`/advanced/${id}/ocr-page`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ page: 1, lang: 'eng' }) }, [200, 501]));
  await check('advanced-searchable-host-gated', () => request(`/advanced/${id}/searchable-pdf`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ lang: 'eng' }) }, [200, 501]));
  await check('advanced-ocr-corrections', () => request(`/advanced/${id}/ocr-corrections`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ corrections: [{ page: 1, from: 'USD', to: 'USD', confidence: 'manual' }] }) }));

  await check('security-encrypt-host-gated', () => request(`/security/${id}/encrypt`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ password: 'ChangeMe123!' }) }, [200, 501]));
  await check('security-linearize-host-gated', () => request(`/security/${id}/linearize`, { method: 'POST', headers: jsonHeaders, body: '{}' }, [200, 501]));

  for (const deleteId of [...createdDocumentIds].reverse()) {
    await request(`/documents/${deleteId}`, { method: 'DELETE' }, [200, 404]);
  }
  await request('/documents/session/clear', { method: 'POST', headers: jsonHeaders, body: '{}' }, [200]);

  console.log(JSON.stringify({
    ok: true,
    mode: 'free-no-auth',
    baseUrl: BASE,
    session: SESSION,
    checked: results.length,
    riskScore: analysis.analysis.riskModel.score,
    keywords: analysis.analysis.keywords.slice(0, 6),
    entities: analysis.analysis.entities,
    results
  }, null, 2));
}

run().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
