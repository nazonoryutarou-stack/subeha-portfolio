# Neocities archive

This directory preserves files recovered from and captured from the Neocities site.

- `snapshot-2026-09-01/site/`: every non-directory file returned by the authenticated Neocities API at capture time, with original paths preserved.
- `snapshot-2026-09-01/metadata/`: before/after manifests and per-file verification data.
- `snapshot-2026-09-01/recovered/`: overwritten files recovered from earlier sources.
- Files directly under this directory are earlier individually recovered items.

The snapshot was produced by `.github/workflows/archive-neocities.yml`. See its `README.txt` and `SHA1SUMS` for provenance and integrity details.
