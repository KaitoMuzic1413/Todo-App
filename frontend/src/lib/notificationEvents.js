import { fetchUnreadNotificationCount } from './api';
import { API_BASE_URL } from './apiConfig';

const RETRY_DELAY = 5000;

const parseEventChunk = (chunk) => {
  const data = chunk
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

export const openNotificationEventStream = (onEvent) => {
  let closed = false;
  let controller = null;
  let reader = null;
  let retryTimer = null;

  const connect = async () => {
    if (closed) return;

    const token = localStorage.getItem('token');
    if (!token) {
      retryTimer = window.setTimeout(connect, RETRY_DELAY);
      return;
    }

    controller = new AbortController();
    let shouldRetry = true;

    try {
      const response = await fetch(`${API_BASE_URL}/notifications/events`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        if (response.status === 401) {
          try {
            await fetchUnreadNotificationCount();
          } catch {
            shouldRetry = false;
          }
        }
        throw new Error(`Notification event stream failed with status ${response.status}.`);
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const event = parseEventChunk(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          if (event) onEvent(event);
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || closed) return;
    } finally {
      reader = null;
    }

    if (!closed && shouldRetry) {
      retryTimer = window.setTimeout(connect, RETRY_DELAY);
    }
  };

  void connect();

  return () => {
    closed = true;
    window.clearTimeout(retryTimer);
    controller?.abort();
    reader?.cancel().catch(() => {});
  };
};
