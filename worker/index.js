const API_PREFIX = '/api';

const PROXY_REQUEST_HEADERS_TO_DROP = [
  'host',
  'origin',
  'referer',
  'accept-encoding',
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cdn-loop',
];

const isApiRequest = (pathname) => pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);

const jsonResponse = (status, message) => new Response(JSON.stringify({ message }), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
});

const normalizeOrigin = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
};

const proxyApiRequest = async (request, env) => {
  const apiOrigin = normalizeOrigin(env.API_ORIGIN);
  if (!apiOrigin) {
    console.error('API_ORIGIN is missing or invalid. Set it in wrangler.jsonc or the Cloudflare dashboard.');
    return jsonResponse(500, 'The API origin is not configured on this Worker.');
  }

  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiOrigin);

  const headers = new Headers(request.headers);
  for (const header of PROXY_REQUEST_HEADERS_TO_DROP) headers.delete(header);

  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) headers.set('X-Forwarded-For', clientIp);
  headers.set('X-Forwarded-Host', incomingUrl.host);
  headers.set('X-Forwarded-Proto', incomingUrl.protocol.replace(':', ''));

  const canHaveBody = request.method !== 'GET' && request.method !== 'HEAD';
  const init = {
    method: request.method,
    headers,
    redirect: 'follow',
  };
  if (canHaveBody) {
    init.body = request.body;
    init.duplex = 'half';
  }

  let response;
  try {
    response = await fetch(new Request(targetUrl, init));
  } catch (error) {
    console.error('API proxy request failed:', error);
    return jsonResponse(502, 'Unable to reach the API server. Please try again.');
  }

  if (response.status === 404 && response.headers.get('x-render-routing') === 'no-server') {
    console.error(`API_ORIGIN points to a Render URL with no running service: ${apiOrigin}`);
    return jsonResponse(502, 'The API server is not deployed at the configured Render URL.');
  }

  return response;
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (isApiRequest(pathname)) {
      return proxyApiRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
