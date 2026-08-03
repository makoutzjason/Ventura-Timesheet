import { Resend } from "resend";

let client: Resend | null = null;

// Built lazily, on first actual send — not at module load. Importing this
// file (which every submit happens to do, even for facilities that skip
// manager approval) must never throw just because RESEND_API_KEY isn't set
// yet; only actually trying to send an email should.
export function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}
