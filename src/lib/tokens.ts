import { randomBytes, createHash } from "crypto";

// Generates the secret that goes in a manager's email link, plus the hash
// of it that gets stored in approval_tokens.token_hash. We never store the
// raw token — only its SHA-256 hash — so a database leak alone can't be
// used to approve timesheets; you'd need the email too.
export function generateApprovalToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashApprovalToken(token) };
}

export function hashApprovalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
