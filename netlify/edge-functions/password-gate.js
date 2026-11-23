// Runs before every page and asset request, including the GLB and vendor files.
// Keep this function outside dist. Set SITE_PASSWORD in Netlify, never in source.
const encoder = new TextEncoder();

async function equalCredentials(actual, expected) {
  const [a, b] = await Promise.all([actual, expected].map(value =>
    crypto.subtle.digest("SHA-256", encoder.encode(value))
  ));
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

function locked(status, message, challenge = false) {
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "private, no-store",
    "CDN-Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Content-Type-Options": "nosniff",
  };
  if (challenge) headers["WWW-Authenticate"] = 'Basic realm="Private site", charset="UTF-8"';
  return new Response(message, { status, headers });
}

export default async function passwordGate(request, context) {
  const password = Netlify.env.get("SITE_PASSWORD");
  const username = Netlify.env.get("SITE_USERNAME") || "viewer";
  // Missing configuration must never expose the app.
  if (!password || username.includes(":")) {
    return locked(503, "Private demo is awaiting access configuration.");
  }

  const authorization = request.headers.get("authorization") || "";
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
  let credentials = "";
  if (match && match[1].length <= 4096) {
    try {
      credentials = new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(atob(match[1]), char => char.charCodeAt(0))
      );
    } catch { /* Malformed credentials stay locked. */ }
  }

  if (!await equalCredentials(credentials, `${username}:${password}`)) {
    return locked(401, "Enter the shared username and password to continue.", true);
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Netlify-CDN-Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, {
    status: response.status, statusText: response.statusText, headers,
  });
}

// Never enable response caching or bypass on errors for authentication.
export const config = { path: "/*", onError: "fail" };
