import { createTask, deleteTask, toggleTaskStatus, updateTask } from './api';
import { insertTaskTree, removeTaskTree, updateTaskTree } from './offlineTaskTree';

const CACHE_PREFIX = 'kaito-offline-tasks-v1';
const OUTBOX_PREFIX = 'kaito-offline-outbox-v1';

const readJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable in private browsing; online behavior still works.
  }
};

const cacheKey = (userId, contentType) => `${CACHE_PREFIX}:${userId}:${contentType || 'task'}`;
const outboxKey = (userId) => `${OUTBOX_PREFIX}:${userId}`;

export const offlineTaskId = () => (
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `offline-${crypto.randomUUID()}`
    : `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

export const readCachedTasks = (userId, contentType) => {
  if (!userId) return [];
  const tasks = readJson(cacheKey(userId, contentType), []);
  return Array.isArray(tasks) ? tasks : [];
};

export const writeCachedTasks = (userId, contentType, tasks) => {
  if (!userId || !Array.isArray(tasks)) return;
  writeJson(cacheKey(userId, contentType), tasks);
};

export const cacheCreatedTask = (userId, contentType, task) => {
  writeCachedTasks(userId, contentType, insertTaskTree(readCachedTasks(userId, contentType), task));
};

export const cacheUpdatedTask = (userId, contentType, task) => {
  writeCachedTasks(userId, contentType, updateTaskTree(
    readCachedTasks(userId, contentType),
    task._id,
    (current) => ({ ...current, ...task })
  ));
};

export const cacheDeletedTask = (userId, contentType, taskId) => {
  writeCachedTasks(userId, contentType, removeTaskTree(readCachedTasks(userId, contentType), taskId));
};

export const cacheReplacedTaskId = (userId, contentType, temporaryId, task) => {
  const tasks = readCachedTasks(userId, contentType);
  writeCachedTasks(userId, contentType, insertTaskTree(removeTaskTree(tasks, temporaryId), task));
};

export const createOfflineTask = (payload) => ({
  _id: offlineTaskId(),
  title: String(payload.title || '').trim(),
  contentType: payload.contentType || 'task',
  content: payload.content || '',
  items: payload.items,
  important: Boolean(payload.important),
  parentTaskId: payload.parentTaskId || null,
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startAt: payload.startAt || null,
  dueAt: payload.dueAt || null,
  estimatedMinutes: payload.estimatedMinutes ?? null,
  __offline: true,
});

const readOutbox = (userId) => {
  if (!userId) return [];
  const operations = readJson(outboxKey(userId), []);
  return Array.isArray(operations) ? operations : [];
};

const writeOutbox = (userId, operations) => writeJson(outboxKey(userId), operations);

export const enqueueOfflineOperation = (userId, operation) => {
  const queued = { ...operation, queuedAt: new Date().toISOString() };
  writeOutbox(userId, [...readOutbox(userId), queued]);
  return queued;
};

export const pendingOfflineOperations = (userId) => readOutbox(userId).length;

export const countAllPendingOfflineOperations = () => {
  let total = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(OUTBOX_PREFIX)) continue;
      const operations = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(operations)) total += operations.length;
    }
  } catch {
    return total;
  }
  return total;
};

let flushInProgress = false;

export const flushOfflineOperations = async (userId) => {
  if (!userId || flushInProgress || !navigator.onLine) return { processed: 0, failed: 0 };
  flushInProgress = true;
  const remaining = readOutbox(userId);
  const idMap = new Map();
  let processed = 0;
  let failed = 0;

  try {
    while (remaining.length) {
      const operation = remaining[0];
      const taskId = idMap.get(operation.taskId) || operation.taskId;
      const temporaryId = idMap.get(operation.tempId) || operation.tempId;
      const contentType = operation.contentType || operation.payload?.contentType || 'task';

      try {
        if (operation.type === 'create') {
          const payload = { ...operation.payload };
          if (payload.parentTaskId && idMap.has(payload.parentTaskId)) {
            payload.parentTaskId = idMap.get(payload.parentTaskId);
          }
          const response = await createTask({ ...payload, userId });
          const created = response.data;
          if (created?._id && temporaryId) {
            idMap.set(temporaryId, created._id);
            cacheReplacedTaskId(userId, contentType, temporaryId, created);
            remaining.forEach((queued) => {
              if (queued.taskId === temporaryId) queued.taskId = created._id;
              if (queued.payload?.parentTaskId === temporaryId) queued.payload.parentTaskId = created._id;
            });
          }
        } else if (operation.type === 'toggle') {
          if (!taskId?.startsWith('offline-')) {
            const response = await toggleTaskStatus(taskId, userId);
            if (response.data?._id) cacheUpdatedTask(userId, contentType, response.data);
          }
        } else if (operation.type === 'update') {
          if (!taskId?.startsWith('offline-')) {
            const response = await updateTask(taskId, userId, operation.payload || {});
            if (response.data?._id) cacheUpdatedTask(userId, contentType, response.data);
          }
        } else if (operation.type === 'delete') {
          if (!taskId?.startsWith('offline-')) await deleteTask(taskId, userId);
          if (taskId) cacheDeletedTask(userId, contentType, taskId);
        }
        remaining.shift();
        processed += 1;
        writeOutbox(userId, remaining);
      } catch (error) {
        if (error?.response) {
          remaining.shift();
          failed += 1;
          writeOutbox(userId, remaining);
          continue;
        }
        break;
      }
    }
  } finally {
    flushInProgress = false;
  }

  return { processed, failed };
};
