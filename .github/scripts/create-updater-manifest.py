import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote


assets_dir = Path("release-assets")
repository = os.environ["GITHUB_REPOSITORY"]
tag = os.environ["RELEASE_TAG"]
platforms = {}

for target, pattern in (
    ("linux-x86_64", "*.AppImage.tar.gz"),
    ("windows-x86_64", "*.nsis.zip"),
):
    bundles = list(assets_dir.glob(pattern))
    if len(bundles) != 1:
        raise SystemExit(f"Expected one {target} updater bundle, found {len(bundles)}")

    bundle = bundles[0]
    signature_path = Path(f"{bundle}.sig")
    if not signature_path.is_file():
        raise SystemExit(f"Missing updater signature: {signature_path}")

    encoded_name = quote(bundle.name, safe="-_.")
    platforms[target] = {
        "url": f"https://github.com/{repository}/releases/download/{tag}/{encoded_name}",
        "signature": signature_path.read_text(encoding="utf-8").strip(),
    }

manifest = {
    "version": tag.removeprefix("v"),
    "notes": f"Kaito Todo {tag}",
    "pub_date": datetime.now(timezone.utc).isoformat(),
    "platforms": platforms,
}
(assets_dir / "latest.json").write_text(
    json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
)
