# Web, Android and Desktop

React/Vite stays the shared client. All clients call the existing Express API; this setup adds no local task database and does not package MongoDB or the backend.

## Web and PWA

1. Set `VITE_API_BASE_URL` to the deployed API base, including `/api` (for example `https://your-api.example.com/api`). Leave it unset to use the current Render API default.
2. Run `npm run dev` for development. Run `npm run build` to create `dist/`; serve that directory from an HTTPS static host with SPA history fallback for production.
3. The manifest and service worker are in `public/`. The worker caches the app shell and same-origin Vite assets only. It never caches API requests or user data. Offline use displays a notice; sign-in and server-backed data changes still require a connection.
4. Install is offered only when the browser emits its install prompt. On iOS, use the browser's Share → Add to Home Screen menu. In the installed PWA, Settings shows that the app is installed; when a new service worker is ready it shows **Update app**. To publish a PWA update, increase `frontend/package.json`'s `version` (or set a distinct `VITE_APP_VERSION`) and deploy the new build. The browser cannot reliably tell a normal tab that a separate PWA is installed, so installed status is shown when Settings is opened inside the installed app.

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

The Tauri shell loads the same Vite output and talks to the remote API. Install Rust plus the platform webview/build dependencies described in the Tauri v2 prerequisites (WebView2 on Windows; WebKitGTK and GTK development packages on Linux).

```sh
npm run tauri:dev
npm run tauri:build
npm run tauri:build:linux    # On Linux: AppImage
npm run tauri:build:windows  # On Windows: NSIS installer .exe
```

No filesystem, shell or process plugin permissions are configured. Tauri's CSP allows secure HTTPS/WSS API connections. Configure `VITE_API_BASE_URL` to the same backend before building if it differs from the current default.

## Configuration and security notes

- `VITE_API_BASE_URL` is public client configuration, not a secret. MongoDB credentials and JWT signing secrets belong only in backend environment configuration.
- Existing sign-in stores its bearer token in WebView `localStorage`; Android backup is disabled. If the threat model requires OS-backed encrypted token storage, that requires an explicit native secure-storage migration across the app's existing storage use.
- The backend currently reflects arbitrary CORS origins with credentials disabled and has a development fallback when `JWT_SECRET` is unset. Restrict production origins and set a strong `JWT_SECRET` in the backend deployment before release. These existing backend behaviors are not changed by the client packaging work.
- PWA installability requires a production HTTPS deployment. A development server does not test service worker installation.

## Phát hành cho người dùng tải desktop

Repo đã có workflow `.github/workflows/desktop-release.yml`. Sau khi commit và push code lên GitHub, tạo tag phiên bản ở commit muốn phát hành. Tauri version trong `src-tauri/tauri.conf.json` cần khớp tag; ví dụ `1.0.0` với `v1.0.0`.

```sh
git push origin HEAD
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions sẽ build Linux AppImage và Windows NSIS installer `.exe`, sau đó gắn cả hai vào **GitHub → Releases** khi build xanh. Nếu chạy workflow thủ công từ tab Actions, tải hai file trong phần Artifacts của lần chạy (lưu 14 ngày). Đặt GitHub Actions variable `VITE_API_BASE_URL` nếu release dùng API khác; nếu bỏ trống, app dùng backend Render đã cấu hình mặc định.

Người dùng tải bản mới nhất từ trang Releases của repo. Linux: tải file `.AppImage`, cấp quyền chạy (`chmod +x <file>.AppImage`) rồi mở. Windows: tải file setup `.exe` và chạy để cài. Bản `.exe` hiện chưa ký bằng chứng thư nhà phát hành, nên Windows có thể hiện SmartScreen. AppImage/installer cũng chưa được ký; chỉ tải từ Releases chính thức của repo.

## Phát hành Android lên Google Play

1. Cài Android Studio 2025.2.1+ và SDK 36. Đặt `VITE_API_BASE_URL` trỏ tới backend HTTPS.
2. Chạy `npm run build:android`, rồi `npm run android:open`. Trong Android Studio, chạy thử trên máy thật và kiểm tra đăng nhập, tạo/sửa/xóa Todo, mạng yếu và bàn phím.
3. Tăng `versionCode` trong `android/app/build.gradle` cho từng lần upload. Giữ `applicationId` là `com.kaito.todox` sau lần phát hành đầu.
4. Tạo upload keystore bằng Android Studio's **Build → Generate Signed Bundle / APK**, chọn **Android App Bundle**. Giữ file keystore và password ngoài Git. Chọn Play App Signing khi Play Console hỏi.
5. Tạo app trong Play Console, hoàn tất thông tin store listing, icon/screenshots, phân loại nội dung, target audience, privacy policy, Data safety và các câu hỏi về quảng cáo/quyền truy cập. Khai báo đúng dữ liệu tài khoản/task mà app gửi tới backend.
6. Upload signed `.aab` lên Internal testing trước. Với tài khoản cá nhân mới tạo sau 13/11/2023, Google yêu cầu Closed testing có ít nhất 12 tester tham gia liên tục 14 ngày trước khi xin quyền Production. Sau khi được cấp Production access, tạo release Production, chọn quốc gia/khu vực và gửi Google xét duyệt.

Google Play yêu cầu app mới và bản cập nhật nhắm API 36 trở lên từ 31/08/2026. Cấu hình hiện dùng Capacitor 8, `compileSdkVersion`/`targetSdkVersion` 36 và `minSdkVersion` 24. Xem hướng dẫn chính thức về [target API](https://developer.android.com/google/play/requirements/target-sdk), [ký app và Play App Signing](https://developer.android.com/studio/publish/app-signing), [điều kiện closed testing](https://support.google.com/googleplay/android-developer/answer/14151465) và [nâng cấp Capacitor 8](https://capacitorjs.com/docs/updating/8-0).
