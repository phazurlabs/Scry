#!/usr/bin/env python3
"""Extract text from a local PDF file. No network, no secrets, no shelling out."""
import sys

import pdfplumber


def main(path: str) -> None:
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            print(page.extract_text() or "")


if __name__ == "__main__":
    main(sys.argv[1])
