# Changelog

All notable changes to Latch are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial local-first Chrome (Manifest V3) extension: Gmail read-only sync, local detection
  of OTP codes and verification/magic links, and a secure top-right overlay.
- Secure overlay boundary: secrets render only inside an extension-origin iframe; copy/open
  happen by opaque action id via the background.
- Three site-access modes (on-click / selected / all HTTPS), all optional.
- Offscreen document for local email-HTML parsing and clipboard copy (no `clipboardWrite`
  permission needed).
- Adaptive **fast-poll burst**: when a verification email is likely imminent (login/verify
  form submit, verify-button click, connect, or popup open) the worker polls every ~6s for
  ~2 minutes, then reverts to the 30s alarm baseline.
- Developer harness in the popup to exercise the overlay/permission flow without Gmail.
- Docs: privacy design, threat model, Google OAuth setup, testing, Chrome Web Store notes.

[Unreleased]: https://github.com/Manan-Santoki/latch/commits/master
