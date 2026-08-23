import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

describe("platform-wide functional invariants", () => {
  it("keeps picker and drag-and-drop behavior on every upload surface", () => {
    const uploadSurfaces = [
      "./pages/ProvenanceDetector.tsx",
      "./pages/dashboard/VoiceNotes.tsx",
      "./pages/dashboard/VideoAnalyzer.tsx",
      "./pages/dashboard/ContentLibrary.tsx",
      "./pages/dashboard/EditorPage.tsx",
    ].map(source);
    const allPages = filesUnder(new URL("./pages", import.meta.url).pathname)
      .filter(path => path.endsWith(".tsx"))
      .map(path => readFileSync(path, "utf8"));

    expect(
      allPages.reduce(
        (count, text) => count + (text.match(/type="file"/g) || []).length,
        0
      )
    ).toBe(6);
    expect(
      uploadSurfaces.reduce(
        (count, text) =>
          count + (text.match(/useFileDropZone\(/g) || []).length,
        0
      )
    ).toBeGreaterThanOrEqual(6);
    for (const text of uploadSurfaces) {
      expect(text).toContain("useFileDropZone(");
      expect(text).toContain("validateFileSelection(");
    }
  });

  it("keeps browser and server upload limits on one shared contract", () => {
    const validator = source("./lib/file-validation.ts");
    const server = source("../sites/server.ts");
    expect(validator).toContain(
      'import { MAX_UPLOAD_BYTES, UPLOAD_SIZE_LABEL } from "@contracts/uploads"'
    );
    expect(server).toContain('from "../contracts/uploads"');
    expect(server).toContain("file.size > MAX_UPLOAD_BYTES");
    expect(server).toContain("row.bytes > MAX_AI_MEDIA_BYTES");
  });

  it("prevents native buttons from accidentally submitting a surrounding form", () => {
    const componentFiles = filesUnder(
      new URL(".", import.meta.url).pathname
    ).filter(path => path.endsWith(".tsx"));
    const offenders: string[] = [];
    for (const path of componentFiles) {
      const text = readFileSync(path, "utf8");
      for (const match of text.matchAll(
        /<(?:button|motion\.button)\b[\s\S]*?>/g
      )) {
        if (!/\btype\s*=/.test(match[0])) {
          const line = text.slice(0, match.index).split("\n").length;
          offenders.push(`${path}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps every client API family connected to a Worker route", () => {
    const client = source("./lib/platform-api.ts");
    const server = source("../sites/server.ts");
    const endpointFamilies = Array.from(
      new Set(
        Array.from(client.matchAll(/['"`]\/api\/([a-z-]+)/g), match => match[1])
      )
    );
    expect(endpointFamilies).toEqual(
      expect.arrayContaining([
        "ai",
        "assets",
        "capabilities",
        "compliance",
        "projects",
        "provenance",
        "publishing",
        "referrals",
        "session",
        "support",
        "video",
        "workspace",
      ])
    );
    for (const family of endpointFamilies) {
      expect(server).toContain(
        family === "projects" ? "const editBriefMatch" : `/api/${family}`
      );
    }
  });

  it("keeps the official contact flow public, durable, and free of product beta language", () => {
    const app = source("./App.tsx");
    const navbar = source("./components/Navbar.tsx");
    const contact = source("./pages/Support.tsx");
    const api = source("./lib/platform-api.ts");
    const server = source("../sites/server.ts");
    const compliance = source("../contracts/compliance.ts");
    const publicProductSource = [
      app,
      navbar,
      contact,
      api,
      server,
      compliance,
    ].join("\n");

    expect(app).toContain('<Route path="/contact" element={<Support />} />');
    expect(navbar).toContain('<NavItem to="/contact">');
    expect(contact).toContain("REELassati Support");
    expect(contact).toContain("reelassati@gmail.com");
    expect(contact).toContain("https://mail.google.com/mail/");
    expect(contact).toContain("setTicketDraft(result.ticketDraft ?? null)");
    expect(contact).toContain("action.message");
    expect(api).toContain(
      'requestJson<SupportChatResponse>("/api/support/chat"'
    );
    expect(server).toContain("CREATE TABLE IF NOT EXISTS support_tickets");
    expect(server).toContain('"moonshotai/kimi-k2.5"');
    expect(publicProductSource).not.toMatch(
      /\bbeta\b|closed-beta|private-testing/i
    );
  });

  it("keeps the Vercel client deploy free of accidental legacy functions", () => {
    const vercel = JSON.parse(source("../vercel.json")) as {
      buildCommand?: string;
      outputDirectory?: string;
      rewrites?: Array<{ source?: string; destination?: string }>;
    };
    const packageJson = JSON.parse(source("../package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(vercel.buildCommand).toBe("npm run build:client");
    expect(vercel.outputDirectory).toBe("dist/client");
    expect(packageJson.scripts?.["build:client"]).toBe("vite build");
    expect(vercel.rewrites).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ destination: "/api/$1" }),
      ])
    );
    expect(readdirSync(new URL("../api", import.meta.url).pathname)).toEqual([
      "support.ts",
    ]);
    expect(source("../api/support.ts")).toContain(
      "export default { fetch: handleSupport }"
    );
    expect(
      readdirSync(new URL("../legacy-api", import.meta.url).pathname).length
    ).toBeGreaterThan(0);
  });

  it("uses public SaaS authentication and sends bearer tokens to the product API", () => {
    const app = source("./App.tsx");
    const auth = source("./hooks/useAuth.tsx");
    const runtime = source("./lib/runtime.ts");
    const api = source("./lib/platform-api.ts");

    expect(runtime).toContain('hostname.endsWith(".vercel.app")');
    expect(runtime).toContain('"https://reelassati.kevinbiz.chatgpt.site"');
    expect(runtime).toContain("VITE_PLATFORM_API_ORIGIN");
    expect(app).toContain('<Navigate to="/auth/login" replace />');
    expect(auth).toContain("signInWithPassword");
    expect(auth).toContain("signInWithOAuth");
    expect(auth).toContain('"google", "apple", "azure", "github"');
    expect(auth).toContain("Promise.allSettled");
    expect(auth).toContain('event === "PASSWORD_RECOVERY"');
    expect(auth).toContain('"https://www.reelassati.app"');
    expect(auth).toContain(
      "Account services are temporarily unavailable. Please try again in a moment."
    );
    expect(api).toContain(
      "Authorization: `Bearer ${data.session.access_token}`"
    );
  });

  it("rejects HTML fallbacks and reports real upload progress", () => {
    const api = source("./lib/platform-api.ts");
    expect(api).toContain('contentType.includes("json")');
    expect(api).toContain("request.upload.onprogress");
    expect(api).toContain("event.lengthComputable");
    expect(api).not.toContain("onProgress?.(5)");
  });

  it("keeps theme state synchronized and applies it before first paint", () => {
    const theme = source("./hooks/useTheme.ts");
    const html = source("../index.html");
    expect(theme).toContain("useSyncExternalStore");
    expect(theme).toContain('window.addEventListener("storage"');
    expect(theme).toContain('media.addEventListener("change"');
    expect(html).toMatch(/localStorage\.getItem\(['"]theme['"]\)/);
    expect(html).toContain("prefers-color-scheme: dark");
  });

  it("keeps route fallbacks, delayed hash targets, and focused header shortcuts", () => {
    const app = source("./App.tsx");
    const dashboard = source("./pages/Dashboard.tsx");
    const library = source("./pages/dashboard/ContentLibrary.tsx");
    expect(app).toContain("if (retry < 40)");
    expect(app).toContain(
      '<Route path="*" element={<Navigate to="/" replace />} />'
    );
    expect(dashboard).toContain('to="/dashboard/library?focus=search"');
    expect(dashboard).toContain('to="/dashboard#recent-activity"');
    expect(dashboard).toContain('id="recent-activity"');
    expect(library).toContain("searchInputRef.current?.focus()");
  });

  it("keeps heavy Studio tools route-split behind an accessible fallback", () => {
    const dashboard = source("./pages/Dashboard.tsx");
    expect(dashboard).toContain(
      'const EditorPage = lazy(() => import("./dashboard/EditorPage"))'
    );
    expect(dashboard).toContain(
      'const VideoGenerator = lazy(() => import("./dashboard/VideoGenerator"))'
    );
    expect(dashboard).toContain("<Suspense fallback={<StudioPageFallback />}>");
    expect(dashboard).toContain('aria-label="Loading Studio tool"');
  });

  it("keeps clipboard fallback and reliable object-URL downloads", () => {
    const clipboard = source("./lib/clipboard.ts");
    const allSource = filesUnder(new URL(".", import.meta.url).pathname)
      .filter(path => /\.(ts|tsx)$/.test(path) && !path.endsWith(".test.ts"))
      .map(path => readFileSync(path, "utf8"))
      .join("\n");
    expect(clipboard).toContain("navigator.clipboard?.writeText");
    expect(clipboard).toContain('document.execCommand("copy")');
    expect((allSource.match(/navigator\.clipboard/g) || []).length).toBe(2);
    expect(source("./providers/workspace.tsx")).toContain(
      "window.setTimeout(() => URL.revokeObjectURL(url), 0)"
    );
    expect(source("./pages/dashboard/EditorPage.tsx")).toContain(
      "window.setTimeout(() => URL.revokeObjectURL(href), 0)"
    );
  });

  it("keeps authoritative reloads and deleted-asset references consistent", () => {
    const workspace = source("./providers/workspace.tsx");
    const server = source("../sites/server.ts");
    const refreshBlock = workspace.slice(
      workspace.indexOf("const refresh = useCallback"),
      workspace.indexOf(
        "useEffect(() =>",
        workspace.indexOf("const refresh = useCallback")
      )
    );
    expect(refreshBlock).toContain("mutationRef.current += 1");
    expect(refreshBlock).toContain("setUnsaved(false)");
    expect(server).toContain("const availableAssetIds = new Set");
    expect(server).toContain("availableAssetIds.has(clip.assetId)");
    expect(server).toContain("availableAssetIds.has(post.mediaAssetId)");
  });

  it("keeps media controls named and provides caption or transcript alternatives", () => {
    const editor = source("./pages/dashboard/EditorPage.tsx");
    const voice = source("./pages/dashboard/VoiceNotes.tsx");
    const video = source("./pages/dashboard/VideoGenerator.tsx");
    expect(editor).toContain('kind="captions"');
    expect(editor).toContain("No transcript is available yet");
    expect(voice).toContain("voice-source-description");
    expect(voice).toContain("generated-speech-transcript");
    expect(video).toContain("generated-video-caption-status");
  });

  it("keeps the editor transport connected to the actual media preview", () => {
    const editor = source("./pages/dashboard/EditorPage.tsx");
    expect(editor).toContain("mediaPreviewRef");
    expect(editor).toContain("await media.play()");
    expect(editor).toContain("media?.pause()");
    expect(editor).toContain("media.currentTime = clamp(");
    expect(editor).toContain(
      "playheadForMediaTime(event.currentTarget.currentTime)"
    );
    expect(editor).toContain("media.playbackRate =");
    expect(editor).toContain("media.volume =");
  });

  it("keeps referral rewards pending unless billing sends a signed event", () => {
    const referral = source("./pages/dashboard/ReferralPage.tsx");
    const server = source("../sites/server.ts");
    expect(referral).toContain("billingVerificationConfigured");
    expect(referral).toContain(
      "Referral credits activate with verified paid-plan billing."
    );
    expect(server).toContain("REFERRAL_BILLING_WEBHOOK_SECRET");
    expect(server).toContain('request.headers.get("x-reelassati-signature")');
    expect(server).toContain("payment_event_id IS NULL");
    expect(server).toContain("This billing event has already been processed");
  });
});
