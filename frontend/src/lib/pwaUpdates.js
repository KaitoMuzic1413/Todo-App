let waitingWorker = null;
const updateStateEvent = 'todo-pwa-update-state';

export const hasPwaUpdate = () => Boolean(waitingWorker);

export const setWaitingPwaWorker = (worker) => {
  waitingWorker = worker;
  window.dispatchEvent(new Event(updateStateEvent));
};

export const subscribeToPwaUpdate = (callback) => {
  window.addEventListener(updateStateEvent, callback);
  return () => window.removeEventListener(updateStateEvent, callback);
};

export const applyPwaUpdate = () => {
  if (!waitingWorker) return;
  let refreshing = false;
  const reloadWhenActivated = () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', reloadWhenActivated, { once: true });
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
};
