# Solvane Advanced PDF Engine Roadmap

Solvane is open-source document infrastructure. The product must be honest: we will not pretend that arbitrary PDFs can be edited like Word unless the engine can preserve layout, fonts, objects, tables, and scanned text reliably.

## Target capabilities

### 1. True paragraph-level inline editing

Goal: edit existing PDF text directly inside the document surface.

Requirements:

- Parse text runs and coordinates from the PDF.
- Group text fragments into words, lines, paragraphs, and blocks.
- Detect font, size, color, baseline, kerning, line height, and bounding boxes.
- Allow inline edits in a visual overlay.
- Re-render the edited text back into the PDF.
- Preserve non-edited content.
- Handle embedded/subset fonts safely.
- Fall back gracefully when a PDF uses outlines, scanned images, or malformed text layers.

Possible engines:

- PDF.js for visual/text extraction.
- pdf-lib for basic write operations.
- MuPDF / PyMuPDF for deeper text block and object work.
- qpdf for structural transformations.
- Future native service for high-fidelity edits.

Non-negotiable standard:

- If text cannot be edited safely, Solvane must say so and offer overlay text/redaction instead.

### 2. Professional reflow of complex PDF layouts

Goal: when text changes, surrounding layout should adjust professionally.

Requirements:

- Block-level layout model.
- Paragraph reflow engine.
- Collision detection with images/tables/signatures.
- Page overflow handling.
- Multi-column layout handling.
- Table and list detection.
- Font fallback and substitution rules.
- Visual diff before saving.

This is not a simple overlay feature. It is a full document layout engine.

Phased approach:

1. Edit simple single-column text blocks.
2. Reflow within the same bounding box.
3. Reflow across page sections.
4. Add table-aware editing.
5. Add multi-column and legal-document layouts.

### 3. Advanced OCR editing for scanned PDFs

Goal: make scanned PDFs searchable and editable with correction tools.

Requirements:

- OCR text extraction.
- Language detection.
- OCR confidence scoring.
- Bounding boxes for recognized words/lines.
- OCR correction UI.
- Search recognized text.
- Export OCR text layer into PDF.
- Batch OCR for multiple pages.
- Scan cleanup: deskew, contrast, denoise, crop, rotate.

Possible engines:

- Tesseract for open-source baseline OCR.
- Azure AI Vision / Document Intelligence for production OCR where configured by self-hosters.
- OCRmyPDF for searchable PDF generation.
- OpenCV/ImageMagick for cleanup pipeline.

Important limitation:

- Advanced OCR editing cannot work without an OCR engine/provider installed and configured. Solvane should expose the engine status clearly.

## Product rules

1. Do not fake PDF editing capabilities.
2. Do not claim Word-like editing for arbitrary PDFs until the engine supports it.
3. Always preserve the original document and create a new version.
4. Always show confidence/limitations when editing extracted/scanned content.
5. Prefer open-source/local engines by default.
6. Keep provider keys backend-only.
7. Never commit user PDFs, uploads, secrets, or OCR output caches to the public repo.

## Current Solvane capabilities

Solvane currently supports practical Preview-class operations:

- PDF upload and viewing.
- Page add/delete/extract/reorder/duplicate/rotate/crop.
- Highlight, underline, strike-through.
- Notes, comments, text boxes, speech bubbles.
- Basic redaction boxes.
- Signature evidence.
- Form text overlay/fill groundwork.
- PDF to image export.
- Image to PDF API.
- Password protection/decryption with qpdf.
- Metadata cleanup.
- Bates numbering.
- Share links.
- Desktop wrappers for macOS/Linux.

## Next implementation milestones

### Milestone A — OCR foundation

- Add OCR engine status endpoint.
- Add OCRmyPDF/Tesseract integration option.
- Add searchable text layer generation.
- Add OCR output preview.

### Milestone B — text block inspection

- Add extracted text block endpoint.
- Show text bounding boxes over PDF preview.
- Let user select a text block.
- Show whether selected block is editable, image-only, or unsafe.

### Milestone C — safe inline text edit

- Edit simple text blocks.
- Save as a new PDF version.
- Add confidence warnings.
- Keep original unchanged.

### Milestone D — layout reflow

- Reflow within bounded blocks.
- Collision detection.
- Page overflow handling.
- Table/list detection.

### Milestone E — professional/legal workflows

- Version comparison.
- Advanced redaction review.
- Multi-user comments.
- Legal review workflow.
- Accessibility tagging plan.
