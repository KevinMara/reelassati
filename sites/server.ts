type AssetBinding = {
  fetch(request: Request): Promise<Response>;
};

type SitesEnvironment = {
  ASSETS: AssetBinding;
};

export default {
  async fetch(request: Request, env: SitesEnvironment): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        {
          error: "The original REELassati API requires its external database and service configuration.",
        },
        { status: 503 },
      );
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || request.method !== "GET") {
      return assetResponse;
    }

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (!acceptsHtml) {
      return assetResponse;
    }

    const indexUrl = new URL("/index.html", url);
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
