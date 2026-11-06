const subscribers = new Map();

const normalizeUserId = (userId) => String(userId);

export const publishNotificationEvent = (userIds, event) => {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  const uniqueUserIds = new Set((userIds || []).filter(Boolean).map(normalizeUserId));

  uniqueUserIds.forEach((userId) => {
    const connections = subscribers.get(userId);
    if (!connections) return;

    connections.forEach((res) => {
      try {
        res.write(payload);
      } catch {
        connections.delete(res);
      }
    });

    if (!connections.size) subscribers.delete(userId);
  });
};

export const subscribeNotificationEvents = (userId, res) => {
  const key = normalizeUserId(userId);
  const connections = subscribers.get(key) || new Set();
  connections.add(res);
  subscribers.set(key, connections);

  return () => {
    connections.delete(res);
    if (!connections.size) subscribers.delete(key);
  };
};
