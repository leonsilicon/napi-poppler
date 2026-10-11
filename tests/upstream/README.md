# Upstream compatibility tests

`index.test.cjs` and `fixtures/` are unchanged copies of node-poppler 11.0.0
at commit `43a97d7c5e8cf3c06189fd889989c16bdb9f7e1a`.
`manifest.json` records SHA-256 hashes for every vendored file.

Run `vp run test:upstream`. The runner verifies all hashes, applies
`patches/upstream-tests.diff`, and runs the entire original Jest suite.
The adaptation translates module loading and process mocks to ESM. A strict
equality check against `scripts/upstream-esm.mjs` rejects unreviewed changes;
all test assertions, conditions, skips, and fixtures remain upstream's.
Upstream's mocks exercise the same output-decoding and
error handling logic as before, while every unmocked operation goes through
the Rust addon. The tests keep their original conditional checks for options
introduced after the installed Poppler version.

CI repeats the full suite using an npm tarball installed in a clean directory
with `--ignore-scripts`. Separate integration checks remove PATH to verify
that consumers do not need system Poppler, Rust, or a compiler.
