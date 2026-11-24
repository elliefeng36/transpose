export const SESSION_SECONDS = 30 * 60;

export class SessioningConcept {
  private readonly sessions = new Map<string, { subject: string; expiresAt: number }>();

  constructor(private readonly clock = Date.now) {}

  start({ subject }: { subject: string }) {
    const now = this.clock();
    for (const [session, entry] of this.sessions) {
      if (entry.expiresAt <= now) this.sessions.delete(session);
    }
    const session = crypto.randomUUID();
    this.sessions.set(session, { subject, expiresAt: now + SESSION_SECONDS * 1000 });
    return { session };
  }

  end({ session }: { session: string }) {
    this.sessions.delete(session);
    return { ended: true };
  }

  _active({ session }: { session: string }) {
    const entry = this.sessions.get(session);
    return entry && entry.expiresAt > this.clock() ? [{ subject: entry.subject }] : [];
  }
}
