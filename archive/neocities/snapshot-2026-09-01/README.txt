Neocities complete archive
===========================

site/
  Every non-directory file returned by the authenticated Neocities /api/list
  endpoint at snapshot time, preserving its original path.

recovered/
  Files recovered from prior user-provided sources that had already been
  overwritten on the live Neocities site. These are separated from site/ to keep
  provenance explicit.

metadata/info.json
  Authenticated Neocities site information.

metadata/manifest-before.json
metadata/manifest-after.json
  Authoritative Neocities file lists before and after capture. The job fails if
  they differ.

metadata/verification.json
  Per-file size and SHA1 verification against the Neocities manifest.

SHA1SUMS
  Local SHA1 checksums for both the live snapshot and recovered files.

The job fails if any listed Neocities file cannot be downloaded, if its size or
SHA1 differs from the API manifest, or if the site changes while capture is in
progress. The recovered pre-migration index is separately labeled because it was
no longer live when the authenticated snapshot was taken.
