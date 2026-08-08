// ═══════════════════════════════════════════════════════════════════════════════
// ZERNIOS API CLIENT
// ═══════════════════════════════════════════════════════════════════════════════
// Unified social media publishing API — 15 platforms, one integration.
// Replace placeholder API key with real key from zernio.com when ready.
// ═══════════════════════════════════════════════════════════════════════════════

const ZERNIO_BASE_URL = "https://api.zernio.com/v1";
const API_KEY = process.env.ZERNIO_API_KEY || "";

function headers() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

// ── Check if Zernio is configured ────────────────────────────────────────────
export function isConfigured(): boolean {
  return API_KEY.length > 0;
}

// ── Platform Types ───────────────────────────────────────────────────────────
export type ZernioPlatform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "x"
  | "facebook"
  | "linkedin"
  | "pinterest"
  | "threads"
  | "reddit"
  | "bluesky"
  | "google_business"
  | "telegram"
  | "snapchat"
  | "whatsapp"
  | "discord";

export const ZERNIO_PLATFORMS: {
  id: ZernioPlatform;
  name: string;
  posting: boolean;
}[] = [
  { id: "tiktok", name: "TikTok", posting: true },
  { id: "instagram", name: "Instagram", posting: true },
  { id: "youtube", name: "YouTube", posting: true },
  { id: "x", name: "X / Twitter", posting: true },
  { id: "facebook", name: "Facebook", posting: true },
  { id: "linkedin", name: "LinkedIn", posting: true },
  { id: "pinterest", name: "Pinterest", posting: true },
  { id: "threads", name: "Threads", posting: true },
  { id: "reddit", name: "Reddit", posting: true },
  { id: "bluesky", name: "Bluesky", posting: true },
  { id: "google_business", name: "Google Business", posting: false },
  { id: "telegram", name: "Telegram", posting: true },
  { id: "snapchat", name: "Snapchat", posting: false },
  { id: "whatsapp", name: "WhatsApp", posting: false },
  { id: "discord", name: "Discord", posting: true },
];

// ── Step 1: Initiate OAuth Connection ────────────────────────────────────────
// Returns a URL to redirect the user to for platform OAuth
export async function initiateConnect(
  platform: ZernioPlatform,
  redirectUri: string,
  state?: string
): Promise<{ authUrl: string; requestId: string } | null> {
  try {
    const res = await fetch(`${ZERNIO_BASE_URL}/accounts/connect`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ platform, redirect_uri: redirectUri, state }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Step 2: Handle OAuth Callback ────────────────────────────────────────────
// Exchange the callback code for a permanent Zernio account ID
export async function handleCallback(
  requestId: string,
  code: string
): Promise<{
  accountId: string;
  platform: ZernioPlatform;
  accountName: string;
  accountHandle: string;
  avatarUrl?: string;
  followers?: number;
} | null> {
  try {
    const res = await fetch(`${ZERNIO_BASE_URL}/accounts/callback`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ request_id: requestId, code }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Disconnect Account ───────────────────────────────────────────────────────
export async function disconnectAccount(accountId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${ZERNIO_BASE_URL}/accounts/${accountId}/disconnect`,
      {
        method: "POST",
        headers: headers(),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ── List Connected Accounts ──────────────────────────────────────────────────
export async function listAccounts(userId: number): Promise<
  {
    accountId: string;
    platform: ZernioPlatform;
    accountName: string;
    accountHandle: string;
    avatarUrl?: string;
    followers?: number;
    connectedAt: string;
    status: "active" | "expired" | "revoked";
  }[]
> {
  try {
    const res = await fetch(`${ZERNIO_BASE_URL}/accounts?user_id=${userId}`, {
      headers: headers(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ── Publish Content (Immediate) ──────────────────────────────────────────────
export async function publishPost(params: {
  accountId: string;
  content: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  hashtags?: string[];
  mentions?: string[];
  scheduledAt?: string; // ISO 8601 — if omitted, publishes immediately
}): Promise<{
  postId: string;
  platformPostUrl?: string;
  status: "published" | "scheduled" | "pending_review" | "failed";
  publishedAt?: string;
} | null> {
  try {
    const res = await fetch(`${ZERNIO_BASE_URL}/posts`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Schedule Content ─────────────────────────────────────────────────────────
// Same as publishPost but requires scheduledAt
export async function schedulePost(params: {
  accountId: string;
  content: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  hashtags?: string[];
  scheduledAt: string;
}): ReturnType<typeof publishPost> {
  return publishPost(params);
}

// ── Get Post Status ──────────────────────────────────────────────────────────
export async function getPostStatus(postId: string): Promise<{
  postId: string;
  status: "published" | "scheduled" | "pending_review" | "failed";
  platformPostUrl?: string;
  metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    impressions?: number;
  };
} | null> {
  try {
    const res = await fetch(`${ZERNIO_BASE_URL}/posts/${postId}`, {
      headers: headers(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Pull Analytics ───────────────────────────────────────────────────────────
export async function getAnalytics(params: {
  accountId: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  accountId: string;
  platform: ZernioPlatform;
  period: { start: string; end: string };
  summary: {
    posts: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    followers: number;
    followerGrowth: number;
    engagementRate: number;
  };
  posts: {
    postId: string;
    content: string;
    publishedAt: string;
    metrics: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      impressions: number;
    };
  }[];
} | null> {
  try {
    const url = new URL(`${ZERNIO_BASE_URL}/analytics`);
    url.searchParams.set("account_id", params.accountId);
    if (params.startDate) url.searchParams.set("start_date", params.startDate);
    if (params.endDate) url.searchParams.set("end_date", params.endDate);

    const res = await fetch(url.toString(), { headers: headers() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Delete / Unpublish Post ──────────────────────────────────────────────────
export async function deletePost(postId: string): Promise<boolean> {
  try {
    const res = await fetch(`${ZERNIO_BASE_URL}/posts/${postId}`, {
      method: "DELETE",
      headers: headers(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
