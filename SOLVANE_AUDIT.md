# Solvane Product Audit - 2026-05-07

## Critical findings

1. Preview-style editing overlay used an iframe for PDF rendering. If the iframe receives pointer events, parent click handlers may not fire consistently. Fix: active edit overlay must capture pointer events above the iframe.
2. Mobile workspace can still feel dense because PDF preview, edit strip, and action groups compete vertically. Fix: make edit strip compact/sticky and show clear active-mode banner.
3. Users need proof that editing happened. Fix: show last created document link and auto-select generated PDF.
4. PDF actions must be honest and working. Keep advanced paragraph editing/OCR as roadmap, not dummy buttons.
5. Styling needs stronger app-like polish: command bar, active states, no overflow, consistent rounded controls.

## Action taken in this pass

- Rebuild click-to-edit overlay to capture taps/clicks reliably.
- Add crosshair preview dot and active mode message.
- Add last edit result link in the viewer itself.
- Add grouped Mac Preview-like tools: Text, Highlight, Note, Redact, Underline, Strike.
- Improve mobile edit strip and PDF frame sizing.
- Add audit doc for maintainability.
