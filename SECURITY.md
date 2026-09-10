# Security Policy

Latch handles authentication material (one-time codes, verification/magic links) and Gmail
message content locally in the browser. Security reports are taken seriously.

## Reporting a vulnerability

Please **do not** open a public issue for a vulnerability, and do not include a working
exploit or a step-by-step extraction path in any public discussion.

Instead, report privately via GitHub's **[Private vulnerability reporting](https://github.com/Manan-Santoki/latch/security/advisories/new)**
(Security → Report a vulnerability on this repository).

Include:
- a description of the issue and its impact,
- the affected version/commit,
- minimal reproduction steps (describe the class of problem rather than a weaponized exploit).

You can expect an initial acknowledgement within a few days. Fixes for confirmed issues are
prioritized, and we'll coordinate disclosure with you.

## Scope

In scope: the extension code in this repository — the overlay iframe boundary, the message
protocol, URL handling, redaction, storage of secrets, permission handling, and the Gmail
sync pipeline.

Out of scope: your own Google Cloud/OAuth configuration, Chrome itself, and third-party
dependencies (report those upstream, though we want to know if we use them unsafely).

## Design references

- [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) — threats and mitigations.
- [`docs/PRIVACY-DESIGN.md`](docs/PRIVACY-DESIGN.md) — what data is handled and how.
