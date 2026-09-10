/**
 * Latch — Gmail data contracts (§10).
 *
 * `Gmail*` types mirror the subset of the Gmail REST `users.messages.get`
 * (format=FULL) payload that Latch consumes. `ParsedEmail`/`ExtractedLink` are the
 * local, structured result produced by the MIME parser (src/gmail/mime.ts) and the
 * offscreen DOM parser, and handed to the verification pipeline.
 *
 * This file is a shared CONTRACT: import from it; do not edit it as part of module
 * work without coordinating, since multiple modules depend on these shapes.
 */

// ─── Raw Gmail REST shapes (subset) ──────────────────────────────────────────

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessagePartBody {
  size?: number;
  /** URL-safe base64 body data (see mime.decodeBase64Url). */
  data?: string;
  attachmentId?: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: GmailMessagePartBody;
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  /** Epoch millis as a string, per Gmail API. */
  internalDate?: string;
  snippet?: string;
  payload?: GmailMessagePart;
}

// ─── Parsed, local representation ────────────────────────────────────────────

export interface EmailAddress {
  raw: string;
  displayName?: string;
  address?: string;
  /** Registrable/host domain of the address, lower-cased. */
  domain?: string;
}

export interface ExtractedLink {
  /** Exact original href — preserved verbatim for the eventual user-directed open. */
  href: string;
  anchorText: string;
  /** Bounded surrounding text captured for classification. */
  surroundingText: string;
  scheme?: string;
  hostname?: string;
  registrableDomain?: string;
  /** True only for links that pass URL policy for the normal one-click flow. */
  valid: boolean;
}

export interface ParsedEmail {
  messageId: string;
  /** Epoch millis. */
  internalDate: number;
  from: EmailAddress;
  subject: string;
  plainText: string;
  htmlText: string;
  links: ExtractedLink[];
}
