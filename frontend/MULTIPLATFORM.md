# Web, Android and Desktop

React/Vite stays the shared client. All clients call the existing Express API; this setup adds no local task database and does not package MongoDB or the backend.

## Web and PWA

1. Set `VITE_API_BASE_URL` to the deployed API base, including `/api` (for example `https://your-api.example.com/api`). Leave it unset to use the current Render API default.
2. Run `npm run dev` for development. Run `npm run build` to create `dist/`; serve that directory from an HTTPS static host with SPA history fallback for production.
3. The manifest and service worker are in `public/`. The worker caches the app shell and same-origin Vite assets only. It never caches API requests or user data. Offline use displays a notice; sign-in and server-backed data changes still require a connection.
4. Install is offered only when the browser emits its install prompt. On iOS, use the browser's Share → Add to Home Screen menu. In the installed PWA, Settings shows that the app is installed; when a new service worker is ready it shows **Update app**. To publish a PWA update, increase `frontend/package.json`'s `version` (or set a distinct `VITE_APP_VERSION`) and deploy the new build. The browser cannot reliably tell a normal tab that a separate PWA is installed, so installed status is shown when Settings is opened inside the installed app.

## Cloudflare Workers

The repository root includes `wrangler.jsonc` and `worker/index.js`. The Worker serves `frontend/dist` and proxies every `/api/*` request to the API server configured in `wrangler.jsonc` (`vars.API_ORIGIN`). Because the browser calls the Worker's own origin, no cross-origin XHR or CORS preflight is involved.

```sh
npm run build
npx wrangler deploy
```

Use `npm run deploy:cloudflare` to run both steps. If the API moves, update `vars.API_ORIGIN` in `wrangler.jsonc` and redeploy. For a custom domain that is not `*.workers.dev`, build with `VITE_API_BASE_URL=/api` so the client also uses the Worker proxy. The Android and desktop builds keep using the absolute production API URL.

The backend also accepts `*.workers.dev` browsers directly, plus any origin listed in `CORS_ORIGINS`; set `CORS_ORIGINS=*` on the API host if another static host must call it directly.

## Android

Use Node 24, Android Studio 2025.2.1 or newer, and Android SDK 36. Capacitor 8 targets API 36, the current Play submission requirement for new apps and app updates. Before building, set `VITE_API_BASE_URL` to the HTTPS production API. Never point a phone build at `localhost` and never add secrets to Vite variables.

```sh
npm install
npm run build:android       # Vite build followed by npx cap sync android
npm run android:open        # Open the Android project in Android Studio
npm run android:run         # Build/install on a connected device or emulator
npm run android:bundle      # Build the release AAB (signing must be configured separately)
```

The app ID is `com.kaito.todox`. To regenerate launcher icons after changing `public/icons/todo-icon.svg`, update `assets/icon-only.png` and run `npm run android:icons` (requires ImageMagick). In Android Studio, select a device and press Run to test on a real phone (enable developer options and USB debugging first). For a signed Play release, open **Build → Generate Signed Bundle / APK → Android App Bundle**, create or choose an upload keystore, and save it outside Git. Opt in to Play App Signing in Play Console. The `android:bundle` script produces an AAB only when a release signing configuration has been set up; otherwise use Android Studio's signing wizard. Keep the upload key and passwords outside Git and back them up securely. The generated AAB is under `android/app/build/outputs/bundle/release/`.

Google Play Console work still includes creating the app listing, completing content/privacy/data safety disclosures, uploading the signed AAB, configuring countries/pricing and testing tracks, and submitting the release for review. Package name and signing identity must remain stable.

## Desktop with Tauri

The Tauri shell loads the same Vite output and talks to the existing remote Express API. It does not package Node.js, MongoDB, the backend, or backend secrets. The production API defaults to the deployed Render URL in `src/lib/apiConfig.js`; set `VITE_API_BASE_URL` before building only when using a different deployed API. Install Rust and the platform build dependencies described in the Tauri v2 prerequisites (WebView2 on Windows; WebKitGTK and GTK development packages on Linux).

```sh
npm run tauri:dev
npm run tauri:build:linux    # On Linux x64: AppImage and .deb
npm run tauri:build:windows  # On Windows x64: NSIS installer .exe
```

Build outputs are written under `src-tauri/target/release/bundle/`. A Windows installer must be built on Windows; use the GitHub Actions tag workflow to build both target operating systems from one release. To run Linux outputs, make an AppImage executable with `chmod +x <file>.AppImage` and launch it, or install a Debian package with `sudo apt install ./<file>.deb`.

The desktop packages do not require Node.js or npm on the user's computer. They keep using the same hosted API, so sign-in, tasks, notes, calendar, attachments, and other server-backed data remain shared with the web app. Tauri's CSP allows secure HTTPS/WSS API connections. The app checks GitHub Releases for a signed desktop update on startup, installs one when available, and relaunches. Android updates continue through Google Play, and installed PWAs use the service worker update prompt described above.

The website's `/download` page reads the configured public repository's GitHub Releases API. `VITE_GITHUB_REPOSITORY` uses the `owner/repository` format and defaults to this repository. It displays release version, date, notes, sizes, and direct download links only for published `.exe`, `.msi`, `.AppImage`, and `.deb` assets. If GitHub has no desktop files or cannot be reached, it shows status text and the real releases-history link without manufacturing download URLs. Download buttons are hidden on phone-sized screens, where the page explains that these builds target Windows and Linux.

### Desktop release workflow

`.github/workflows/desktop-release.yml` builds Linux x64 AppImage and Debian packages on Ubuntu and a Windows x64 NSIS `.exe` on Windows. It verifies that the three configured version values match the pushed tag, checks for the updater signing key, validates the packaged files and signatures, and attaches only those build outputs plus the signed updater archives and `latest.json` to the GitHub Release. A manual workflow run creates test artifacts and does not publish a release.

Before the first release, configure these repository settings:

- Actions variable `VITE_API_BASE_URL`: optional; omit it to use the production Render API already configured in the client.
- Actions variable `VITE_GITHUB_REPOSITORY`: optional; the website uses `KaitoMuzic1413/Todo-App` when it is unset.
- Actions secret `TAURI_SIGNING_PRIVATE_KEY`: required for updater signatures and it must match the public key in `src-tauri/tauri.conf.json`.
- Actions secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: optional; set it only if the private key has a password.

The documented local private-key path is not present in this checkout. Do not generate a replacement unless the original signing key cannot be recovered: changing the public key means existing desktop installs signed against the old key will not accept future automatic updates and will need a manual reinstall. To intentionally rotate the key, generate it outside the repo with `node node_modules/@tauri-apps/cli/tauri.js signer generate --write-keys <private-key-path>`, update the Tauri `plugins.updater.pubkey` to the generated public key, and store the matching private key in the Actions secret. Keep the private key out of Git and out of client build variables.

For each release, use the same SemVer version in `frontend/package.json`, `frontend/src-tauri/Cargo.toml`, and `frontend/src-tauri/tauri.conf.json`. Commit and push those changes, then push a matching `v` tag:

```sh
node .github/scripts/verify-desktop-version.mjs vX.Y.Z
git push origin HEAD
git tag vX.Y.Z
git push origin vX.Y.Z
```

GitHub Actions builds both operating systems, fails if an expected installer or updater signature is missing, creates the release notes, and attaches the real binaries. Do not create a release by uploading source archives in place of installers. Windows users download and run the `.exe`; Linux users download the `.AppImage` (and may use the `.deb` package instead). The `.exe` is not signed with a commercial publisher certificate, so Windows may show SmartScreen. Installer builds are downloadable from the [official repository releases](https://github.com/KaitoMuzic1413/Todo-App/releases).

## Configuration and security notes

- `VITE_API_BASE_URL` is public client configuration, not a secret. MongoDB credentials and JWT signing secrets belong only in backend environment configuration.
- Existing sign-in stores its bearer token in WebView `localStorage`; Android backup is disabled. If the threat model requires OS-backed encrypted token storage, that requires an explicit native secure-storage migration across the app's existing storage use.
- The backend uses an origin allowlist (`FRONTEND_URL` plus optional `CORS_ORIGINS`), automatically accepts `*.workers.dev` and `*.pages.dev`, and runs with credentials disabled. Set `CORS_ORIGINS=*` only when any origin must call the API directly. Set a strong `JWT_SECRET` in the backend deployment before release.
- PWA installability requires a production HTTPS deployment. A development server does not test service worker installation.

## Phát hành cho người dùng tải desktop

Repo đã có workflow `.github/workflows/desktop-release.yml` và trang tải `/download`. Xem mục **Desktop release workflow** phía trên để cấu hình signing secret, đồng bộ version, tạo tag và tải app. Release đầu tiên có thể cần cài thủ công; sau đó app desktop hỗ trợ cập nhật tự động bằng artifact updater có chữ ký. Cần giữ khóa riêng ngoài repo và cấu hình đúng public key trong Tauri.

## Phát hành Android lên Google Play

1. Cài Android Studio 2025.2.1+ và SDK 36. Đặt `VITE_API_BASE_URL` trỏ tới backend HTTPS.
2. Chạy `npm run build:android`, rồi `npm run android:open`. Trong Android Studio, chạy thử trên máy thật và kiểm tra đăng nhập, tạo/sửa/xóa Todo, mạng yếu và bàn phím.
3. Tăng `versionCode` trong `android/app/build.gradle` cho từng lần upload. Giữ `applicationId` là `com.kaito.todox` sau lần phát hành đầu.
4. Tạo upload keystore bằng Android Studio's **Build → Generate Signed Bundle / APK**, chọn **Android App Bundle**. Giữ file keystore và password ngoài Git. Chọn Play App Signing khi Play Console hỏi.
5. Tạo app trong Play Console, hoàn tất thông tin store listing, icon/screenshots, phân loại nội dung, target audience, privacy policy, Data safety và các câu hỏi về quảng cáo/quyền truy cập. Khai báo đúng dữ liệu tài khoản/task mà app gửi tới backend.
6. Upload signed `.aab` lên Internal testing trước. Với tài khoản cá nhân mới tạo sau 13/11/2023, Google yêu cầu Closed testing có ít nhất 12 tester tham gia liên tục 14 ngày trước khi xin quyền Production. Sau khi được cấp Production access, tạo release Production, chọn quốc gia/khu vực và gửi Google xét duyệt.

Google Play yêu cầu app mới và bản cập nhật nhắm API 36 trở lên từ 31/08/2026. Cấu hình hiện dùng Capacitor 8, `compileSdkVersion`/`targetSdkVersion` 36 và `minSdkVersion` 24. Xem hướng dẫn chính thức về [target API](https://developer.android.com/google/play/requirements/target-sdk), [ký app và Play App Signing](https://developer.android.com/studio/publish/app-signing), [điều kiện closed testing](https://support.google.com/googleplay/android-developer/answer/14151465) và [nâng cấp Capacitor 8](https://capacitorjs.com/docs/updating/8-0).
