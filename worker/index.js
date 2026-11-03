import { DurableObject } from 'cloudflare:workers';
import { createForwardedHeaders } from './proxyHeaders.js';

const API_PREFIX = '/api';
const API_PORT = 5001;
const CONTAINER_NAME = 'todo-api-primary';
const CONTAINER_IDLE_TIMEOUT_MS = 120_000;
const STARTUP_ATTEMPTS = 80;
const STARTUP_RETRY_MS = 250;

const isApiRequest = (pathname) => pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);

const jsonResponse = (status, message) => new Response(JSON.stringify({ message }), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
});

const getContainerEnvironment = (env) => {
  const values = {
    NODE_ENV: 'production',
    PORT: String(API_PORT),
    RUN_MAINTENANCE_JOBS: 'false',
    FRONTEND_URL: env.FRONTEND_URL,
    MONGODB_CONNECTIONSTRING: env.MONGODB_CONNECTIONSTRING,
    JWT_SECRET: env.JWT_SECRET,
    OTP_SECRET: env.OTP_SECRET,
    INTERNAL_JOB_SECRET: env.INTERNAL_JOB_SECRET,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN,
    REFRESH_TOKEN_TTL_DAYS: env.REFRESH_TOKEN_TTL_DAYS,
    CORS_ORIGINS: env.CORS_ORIGINS,
    ADMIN_EMAIL: env.ADMIN_EMAIL,
    EMAIL_PROVIDER: env.EMAIL_PROVIDER,
    EMAIL_FROM: env.EMAIL_FROM,
    EMAIL_USER: env.EMAIL_USER,
    EMAIL_PASS: env.EMAIL_PASS,
    SENDGRID_API_KEY: env.SENDGRID_API_KEY,
    RESEND_API_KEY: env.RESEND_API_KEY,
    EMAIL_VERIFICATION_REQUIRED: env.EMAIL_VERIFICATION_REQUIRED,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: env.VAPID_SUBJECT,
  };

  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === 'string' && value.length > 0)
  );
};

export class ApiContainer extends DurableObject {
  starting;
  ready = false;

  async fetch(request) {
    const container = this.ctx.container;

    if (!container.running || !this.ready) {
      this.starting ??= this.startAndWaitForPort().finally(() => {
        this.starting = undefined;
      });
      await this.starting;
    } else {
      await container.setInactivityTimeout(CONTAINER_IDLE_TIMEOUT_MS);
    }

    const incomingUrl = new URL(request.url);
    const targetUrl = new URL(incomingUrl);
    targetUrl.protocol = 'http:';
    targetUrl.host = 'container';

    const headers = new Headers(request.headers);
    headers.delete('host');
    const init = {
      method: request.method,
      headers,
      redirect: request.redirect,
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }
    const forwarded = new Request(targetUrl, init);

    try {
      return await container.getTcpPort(API_PORT).fetch(forwarded);
    } catch (error) {
      this.ready = false;
      throw error;
    }
  }

  async startAndWaitForPort() {
    const container = this.ctx.container;

    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: 'standard-1',
        enableInternet: true,
        env: getContainerEnvironment(this.env),
      });
    }

    await container.setInactivityTimeout(CONTAINER_IDLE_TIMEOUT_MS);
    const port = container.getTcpPort(API_PORT);
    let lastError;

    for (let attempt = 0; attempt < STARTUP_ATTEMPTS; attempt += 1) {
      try {
        const response = await port.fetch('http://container/api/health', {
          signal: AbortSignal.timeout(1500),
        });
        await response.body?.cancel();

        if (response.ok) {
          this.ready = true;
          return;
        }

        throw new Error(`Backend readiness check returned HTTP ${response.status}.`);
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, STARTUP_RETRY_MS));
      }
    }

    this.ready = false;
    throw new Error('Backend container did not become ready in time.', { cause: lastError });
  }
}

const forwardApiRequest = async (request, env) => {
  const headers = createForwardedHeaders(request);
  const forwarded = new Request(request, { headers });

  try {
    return await env.API_CONTAINER.getByName(CONTAINER_NAME).fetch(forwarded);
  } catch (error) {
    console.error('Backend container request failed:', error);
    return jsonResponse(503, 'The API service is starting or temporarily unavailable. Please retry.');
  }
};

const runScheduledJob = async (controller, env) => {
  if (!env.INTERNAL_JOB_SECRET) {
    console.error('INTERNAL_JOB_SECRET is missing; scheduled backend jobs were skipped.');
    return;
  }

  const job = controller.cron === '0 * * * *' ? 'maintenance' : 'reminders';
  const request = new Request(`https://internal.invalid/api/internal/jobs/${job}`, {
    method: 'POST',
    headers: {
      'X-Internal-Job-Secret': env.INTERNAL_JOB_SECRET,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  try {
    const response = await env.API_CONTAINER.getByName(CONTAINER_NAME).fetch(request);
    if (!response.ok) {
      console.error(`Scheduled job "${job}" failed with HTTP ${response.status}:`, await response.text());
      return;
    }

    console.log(`Scheduled job "${job}" completed.`);
  } catch (error) {
    console.error(`Scheduled job "${job}" could not reach the API container:`, error);
  }
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (isApiRequest(pathname)) {
      return forwardApiRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },

  scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledJob(controller, env));
  },
};
