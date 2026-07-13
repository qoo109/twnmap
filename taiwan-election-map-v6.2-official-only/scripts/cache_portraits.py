#!/usr/bin/env python3
import io
import json
import os
import hashlib
import urllib.request
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "election-data.json"
OUT_DIR = ROOT / "assets" / "portraits" / "cache"
OUT_DIR.mkdir(parents=True, exist_ok=True)

with DATA_PATH.open(encoding="utf-8") as fh:
    data = json.load(fh)

changed = 0
failed = []
processed = 0

for collection_name in ("officeholders", "candidates"):
    for person in data.get(collection_name, []):
        photo = person.get("photo") or {}
        if not photo or not photo.get("official"):
            continue
        existing_local = photo.get("localUrl")
        if existing_local and (ROOT / existing_local).exists():
            continue
        url = photo.get("url") or photo.get("sourceUrl")
        if not url or not str(url).startswith(("http://", "https://")):
            continue
        processed += 1
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "TaiwanElectionMap/6.1 official-photo-cache"})
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read(12 * 1024 * 1024)
            image = Image.open(io.BytesIO(raw))
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.thumbnail((640, 800), Image.Resampling.LANCZOS)
            digest = hashlib.sha256((person.get("id", "") + url).encode()).hexdigest()[:16]
            target = OUT_DIR / f"{person.get('id','person')}-{digest}.webp"
            image.save(target, "WEBP", quality=84, method=6)
            photo["localUrl"] = target.relative_to(ROOT).as_posix()
            photo["cachedFormat"] = "webp"
            photo["cachedWidth"], photo["cachedHeight"] = image.size
            person["photo"] = photo
            changed += 1
        except Exception as exc:
            failed.append(f"{person.get('id','unknown')}: {exc}")

with DATA_PATH.open("w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=2)
    fh.write("\n")

status = {
    "processedRemoteOfficialPhotos": processed,
    "cachedPhotos": changed,
    "failedCount": len(failed),
    "errors": failed[:30],
}
with (ROOT / "data" / "reports" / "portrait-cache.json").open("w", encoding="utf-8") as fh:
    json.dump(status, fh, ensure_ascii=False, indent=2)
    fh.write("\n")
print(f"官方頭貼本地化：新增 {changed} 張 WebP，失敗 {len(failed)} 張。")
