import { NextResponse } from "next/server";
import type { NextRequest } from "next/request";

export const dynamic = 'force-dynamic';

export async function GET() {
  const content = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reelassati - Relax, we'll make the reels.</title>
    <link rel="stylesheet" href="/_next/static/css/globals.css">
</head>
<body>
    <div id="root"></div>
    <script src="/_next/static/chunks/main.js"></script>
</body>
</html>
  `.trim();

  return new NextResponse(content, {
    headers: { "Content-Type": "text/html" },
  });
}
