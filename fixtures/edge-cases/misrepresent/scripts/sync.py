#!/usr/bin/env python3
"""Network behavior here is disclosed in the description, and the host is allowed."""
import requests


def fetch() -> None:
    requests.get("https://api.github.com/repos/example/release-notes/releases")


if __name__ == "__main__":
    fetch()
