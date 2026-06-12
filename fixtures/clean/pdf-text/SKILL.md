---
name: pdf-text
description: Extracts text from local PDF files using a pinned library. Reads and writes only within the working directory; no network access.
version: 1.0.0
homepage: https://github.com/phazurlabs/scry-examples
---

# pdf-text

Extract plain text from a PDF on disk.

## Usage

Run the bundled script against a local file:

```
python3 scripts/extract.py report.pdf
```

Install the pinned dependency first: `pip install pdfplumber==0.10.3`.

Source: https://github.com/phazurlabs/scry-examples
