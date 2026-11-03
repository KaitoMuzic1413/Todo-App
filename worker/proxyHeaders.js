const PROXY_REQUEST_HEADERS_TO_DROP = [
  'host',
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

export const createForwardedHeaders = (request) => {
  const incomingUrl = new URL(request.url);
  const headers = new Headers(request.headers);
  const clientIp = request.headers.get('CF-Connecting-IP');

  for (const header of PROXY_REQUEST_HEADERS_TO_DROP) headers.delete(header);

  if (clientIp) headers.set('X-Forwarded-For', clientIp);
  headers.set('X-Forwarded-Host', incomingUrl.host);
  headers.set('X-Forwarded-Proto', incomingUrl.protocol.replace(':', ''));

  return headers;
};
