"""Network transport shim for GitHub-hosted runners.

Wikimedia's upload CDN can rate-limit shared GitHub Actions egress IPs even when
Commons API requests themselves are fine. For image bytes only, route the same
Wikimedia source URL through wsrv.nl, a free/open-source caching image proxy.
Source attribution and license metadata still come from Wikimedia Commons.
"""
from __future__ import annotations

from urllib.parse import unquote, urlsplit, urlunsplit

import requests

_ORIGINAL_GET = requests.get


def _clean(url: str) -> str:
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, p.path, "", ""))


def _get(url, *args, **kwargs):
    if isinstance(url, str) and urlsplit(url).hostname == "upload.wikimedia.org":
        origin = unquote(_clean(url))
        kwargs.pop("params", None)
        proxy_params = {"url": origin, "w": "1200", "output": "jpg", "q": "84"}
        print(f"INFO proxying Wikimedia image via wsrv.nl: {origin}", flush=True)
        return _ORIGINAL_GET("https://wsrv.nl/", *args, params=proxy_params, **kwargs)
    return _ORIGINAL_GET(url, *args, **kwargs)


requests.get = _get
