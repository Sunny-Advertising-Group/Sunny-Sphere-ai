// Helpers for the Drive metadata sync (app/api/cron/sync-drive-metadata).
// Files must already be shared "Anyone with the link can view" — we call the
// Drive API with a plain API key, not a service account, which only works
// for content that's already publicly link-viewable.

const ID_PATTERNS = [
  /\/folders\/([a-zA-Z0-9_-]{10,})/,
  /\/d\/([a-zA-Z0-9_-]{10,})/,
  /[?&]id=([a-zA-Z0-9_-]{10,})/,
];

export function extractDriveFileId(url: string): string | null {
  for (const pattern of ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export type DriveMetadata = {
  modifiedTime: string | null;
  modifiedByName: string | null;
};

export async function fetchDriveMetadata(fileId: string, apiKey: string): Promise<DriveMetadata> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime,lastModifyingUser(displayName)&supportsAllDrives=true&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Drive API ${res.status} for file ${fileId}: ${await res.text()}`);
  }
  const json = (await res.json()) as { modifiedTime?: string; lastModifyingUser?: { displayName?: string } };
  return {
    modifiedTime: json.modifiedTime ?? null,
    // Google may withhold this for anonymous/key-only access even when modifiedTime comes through.
    modifiedByName: json.lastModifyingUser?.displayName ?? null,
  };
}

// Accepts either the standard `Authorization: Bearer <secret>` header (what
// Vercel Cron sends) or a `?secret=` query param, so the same URL can be
// pasted straight into a browser address bar for a manual one-off run.
export function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${cronSecret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === cronSecret;
}

export async function fetchDriveCsvExport(fileId: string, apiKey: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Drive export ${res.status} for file ${fileId}: ${await res.text()}`);
  }
  return res.text();
}

// Runs async tasks with bounded concurrency so a client with many links
// doesn't fire dozens of simultaneous requests at once.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
