const DEFAULT_API_ORIGIN = 'https://todo-app-1112.onrender.com';

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

const proxyApiRequest = async (request, env) => {
  const apiOrigin = env.API_ORIGIN || DEFAULT_API_ORIGIN;
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiOrigin);

  const headers = new Headers(request.headers);
  for (const header of PROXY_REQUEST_HEADERS_TO_DROP) headers.delete(header);

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

  try {
    return await fetch(new Request(targetUrl, init));
  } catch (error) {
    console.error('API proxy request failed:', error);
    return Response.json(
      { message: 'Unable to reach the API server. Please try again.' },
      { status: 502 },
    );
  }
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
