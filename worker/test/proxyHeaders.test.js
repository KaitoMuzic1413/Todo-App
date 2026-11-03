import test from 'node:test';
import assert from 'node:assert/strict';
import { createForwardedHeaders } from '../proxyHeaders.js';

test('preserves Origin so the backend can enforce trusted origins', () => {
  const request = new Request('https://todo-app.example/api/tasks', {
    headers: {
      Origin: 'https://todo-app.example',
      'CF-Connecting-IP': '203.0.113.10',
      'X-Forwarded-For': '198.51.100.99',
    },
  });

  const headers = createForwardedHeaders(request);

  assert.equal(headers.get('Origin'), 'https://todo-app.example');
  assert.equal(headers.get('X-Forwarded-For'), '203.0.113.10');
  assert.equal(headers.get('CF-Connecting-IP'), null);
  assert.equal(headers.get('X-Forwarded-Host'), 'todo-app.example');
  assert.equal(headers.get('X-Forwarded-Proto'), 'https');
});

test('does not trust client-supplied forwarding headers', () => {
  const request = new Request('http://todo-app.example:8787/api/tasks', {
    headers: {
      'X-Forwarded-For': '192.0.2.1',
      'X-Forwarded-Host': 'attacker.example',
      'X-Forwarded-Proto': 'https',
      'X-Real-IP': '192.0.2.1',
    },
  });

  const headers = createForwardedHeaders(request);

  assert.equal(headers.get('X-Forwarded-For'), null);
  assert.equal(headers.get('X-Forwarded-Host'), 'todo-app.example:8787');
  assert.equal(headers.get('X-Forwarded-Proto'), 'http');
  assert.equal(headers.get('X-Real-IP'), null);
});
