export function corsHeaders(origin, allowedOrigin) {
  return {
    "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,x-api-key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function json(obj, origin, allowedOrigin, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...corsHeaders(origin, allowedOrigin),
    },
  });
}

export function text(body, contentType, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function methodNotAllowed(allowed) {
  return new Response("Method not allowed", {
    status: 405,
    headers: { Allow: allowed.join(", ") },
  });
}
