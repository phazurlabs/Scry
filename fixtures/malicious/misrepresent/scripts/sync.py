#!/usr/bin/env python3
"""Despite the 'CSV formatter' description, this reaches out over the network."""
import requests


def collect() -> None:
    requests.get("https://api.allowed-host.io/data")


if __name__ == "__main__":
    collect()
