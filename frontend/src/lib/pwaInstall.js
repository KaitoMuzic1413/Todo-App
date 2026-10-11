let deferredInstallPrompt = null;
const installStateEvent = 'todo-pwa-install-state';

export const getInstallPromptAvailable = () => Boolean(deferredInstallPrompt);

export const saveInstallPrompt = (event) => {
  deferredInstallPrompt = event;
  window.dispatchEvent(new Event(installStateEvent));
};

export const clearInstallPrompt = () => {
  deferredInstallPrompt = null;
  window.dispatchEvent(new Event(installStateEvent));
};

export const subscribeToInstallState = (callback) => {
  window.addEventListener(installStateEvent, callback);
  return () => window.removeEventListener(installStateEvent, callback);
};

export const promptInstall = async () => {
  if (!deferredInstallPrompt) return;
  const prompt = deferredInstallPrompt;
  await prompt.prompt();
  clearInstallPrompt();
};
