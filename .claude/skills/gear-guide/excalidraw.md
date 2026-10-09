# Minimal Excalidraw file

Excalidraw (web and Obsidian plugin) fills missing style fields on load, so keep elements bare. Layout: boxes 140×40, 60 px gap on x (`x = i*200`), branches on y = 0 / 80. Text is a free element placed inside its box (x+10, y+10). Arrow: starts at the right edge of the source box, `points` relative to its start.

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "gear-guide",
  "elements": [
    {"id": "b1", "type": "rectangle", "x": 0, "y": 0, "width": 140, "height": 40, "roundness": {"type": 3}},
    {"id": "t1", "type": "text", "x": 10, "y": 10, "width": 120, "height": 20, "text": "Front bloqué", "originalText": "Front bloqué", "fontSize": 16, "fontFamily": 1},
    {"id": "b2", "type": "rectangle", "x": 200, "y": 0, "width": 140, "height": 40, "roundness": {"type": 3}},
    {"id": "t2", "type": "text", "x": 210, "y": 10, "width": 120, "height": 20, "text": "fixup + rebase", "originalText": "fixup + rebase", "fontSize": 16, "fontFamily": 1},
    {"id": "b3", "type": "rectangle", "x": 200, "y": 80, "width": 140, "height": 40, "roundness": {"type": 3}},
    {"id": "t3", "type": "text", "x": 210, "y": 90, "width": 120, "height": 20, "text": "nouveau commit", "originalText": "nouveau commit", "fontSize": 16, "fontFamily": 1},
    {"id": "a1", "type": "arrow", "x": 140, "y": 20, "width": 60, "height": 0, "points": [[0, 0], [60, 0]]},
    {"id": "l1", "type": "text", "x": 150, "y": -8, "width": 40, "height": 14, "text": "PR ✗", "originalText": "PR ✗", "fontSize": 12, "fontFamily": 1},
    {"id": "a2", "type": "arrow", "x": 140, "y": 20, "width": 60, "height": 80, "points": [[0, 0], [60, 80]]},
    {"id": "l2", "type": "text", "x": 150, "y": 62, "width": 40, "height": 14, "text": "PR ✓", "originalText": "PR ✓", "fontSize": 12, "fontFamily": 1}
  ],
  "appState": {"viewBackgroundColor": "#ffffff"},
  "files": {}
}
```

Rules: ≤ 6 boxes, labels ≤ 3 words, edge labels ≤ 2 words (free text above the arrow). Unique ids. No colors unless one box must stand out (`"strokeColor": "#e03131"`).
