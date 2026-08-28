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
        # MediaWiki already percent-encodes many filenames. requests will encode
        # query parameter values again, so decode the origin path once here to
        # prevent `%2C` -> `%252C` and similar double-encoding 404s at wsrv.
        origin = unquote(_clean(url))
        kwargs.pop("params", None)
        proxy_params = {"url": origin, "w": "1200"}
        print(f"INFO proxying Wikimedia image via wsrv.nl: {origin}", flush=True)
        return _ORIGINAL_GET("https://wsrv.nl/", *args, params=proxy_params, **kwargs)
    return _ORIGINAL_GET(url, *args, **kwargs)


requests.get = _get
