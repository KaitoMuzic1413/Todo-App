if (!process.env.TAURI_SIGNING_PRIVATE_KEY?.trim()) {
  console.error('TAURI_SIGNING_PRIVATE_KEY is required to create signed desktop updater artifacts. Configure it as a GitHub Actions secret.');
  process.exit(1);
}

console.log('Desktop updater signing key is configured.');
