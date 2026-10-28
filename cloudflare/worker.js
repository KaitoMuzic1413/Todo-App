const DEFAULT_BACKEND_ORIGIN = 'https://todo-app-1112.onrender.com';

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

const FORWARDED_REQUEST_HEADERS_TO_DROP = [
  'host',
  'origin',
  'referer',
  'cf-connecting-ip',
  'cf-ray',
  'cf-visitor',
  'cf-ipcountry',
  'cdn-loop',
  ...HOP_BY_HOP_HEADERS,
];

const RESPONSE_HEADERS_TO_DROP = [
  'content-encoding',
  'content-length',
  ...HOP_BY_HOP_HEADERS,
];

const jsonResponse = (status, message) => new Response(JSON.stringify({ message }), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

const isApiRequest = (pathname) => pathname === '/api' || pathname.startsWith('/api/');

const proxyToBackend = async (request, url, env) => {
  const backendOrigin = String(env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/+$/, '');
  const target = new URL(`${url.pathname}${url.search}`, backendOrigin);

  const headers = new Headers(request.headers);
  FORWARDED_REQUEST_HEADERS_TO_DROP.forEach((name) => headers.delete(name));

  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) headers.set('X-Forwarded-For', clientIp);
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

  let response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });
  } catch (error) {
    console.error('API proxy request failed:', error);
    return jsonResponse(502, 'The API is temporarily unreachable. Please try again shortly.');
  }

  const responseHeaders = new Headers(response.headers);
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  RESPONSE_HEADERS_TO_DROP.forEach((name) => responseHeaders.delete(name));
  responseHeaders.delete('set-cookie');
  setCookies.forEach((cookie) => responseHeaders.append('set-cookie', cookie));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (isApiRequest(url.pathname)) {
      return proxyToBackend(request, url, env);
    }

    if (!env.ASSETS) {
      return jsonResponse(500, 'Static asset binding is not configured.');
    }

    return env.ASSETS.fetch(request);
  },
};
