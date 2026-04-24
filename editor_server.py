#!/usr/bin/env python3
"""
editor_server.py
吉伊卡哇敏捷簡報 — 視覺化內容編輯器後端
Port: 8001
"""

import http.server
import json
import os
import base64
import mimetypes
from pathlib import Path
from urllib.parse import urlparse

PORT = 8001
BASE_DIR = Path(__file__).resolve().parent
CONTENT_FILE = BASE_DIR / "content.json"

ALLOWED_UPLOAD_DIRS = {
    "assets/audio",
    "assets/images/backgrounds",
    "assets/images/characters",
    "assets/images/points",
}

ALLOWED_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    ".mp3", ".wav", ".ogg", ".m4a"
}

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


class EditorHandler(http.server.BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._add_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/content":
            self._handle_get_content()
        elif path in ("/", "/editor.html"):
            self._serve_file(BASE_DIR / "editor.html")
        else:
            self._serve_static(path)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/save":
            self._handle_save()
        elif path == "/api/upload":
            self._handle_upload()
        else:
            self._send_json({"error": "Not Found"}, 404)

    # ── API handlers ──────────────────────────────────────────

    def _handle_get_content(self):
        try:
            data = CONTENT_FILE.read_text(encoding="utf-8")
            json.loads(data)  # validate JSON
            body = data.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", len(body))
            self._add_cors_headers()
            self.end_headers()
            self.wfile.write(body)
        except FileNotFoundError:
            self._send_json({"error": "content.json not found"}, 404)
        except json.JSONDecodeError as e:
            self._send_json({"error": f"JSON 解析失敗: {e}"}, 500)

    def _handle_save(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            payload = json.loads(body)

            # Basic structure validation
            required = {"mode", "meta", "ui", "audio", "backgrounds", "characters", "slides"}
            missing = required - set(payload.keys())
            if missing:
                raise ValueError(f"缺少必要欄位: {missing}")

            # Atomic write: write to .tmp first, then replace
            tmp_path = CONTENT_FILE.with_suffix(".json.tmp")
            tmp_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
            tmp_path.replace(CONTENT_FILE)
            self._send_json({"ok": True})
        except (json.JSONDecodeError, ValueError) as e:
            self._send_json({"error": str(e)}, 400)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def _handle_upload(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > MAX_UPLOAD_BYTES:
                self._send_json({"error": "檔案過大（上限 20 MB）"}, 413)
                return

            body = self.rfile.read(length)
            payload = json.loads(body)

            # Strip any path components from filename (security)
            filename = os.path.basename(payload["filename"])
            dest_dir = payload["dest_dir"]
            data_b64 = payload["data"]

            # Security: whitelist check
            if dest_dir not in ALLOWED_UPLOAD_DIRS:
                raise ValueError(f"不允許上傳到此目錄: {dest_dir}")

            # Security: resolve and check for path traversal
            dest_path = (BASE_DIR / dest_dir / filename).resolve()
            if not str(dest_path).startswith(str(BASE_DIR.resolve())):
                raise ValueError("非法路徑（路徑穿越攻擊已被阻擋）")

            # Security: extension whitelist
            if dest_path.suffix.lower() not in ALLOWED_EXTS:
                raise ValueError(f"不支援的檔案類型: {dest_path.suffix}")

            # Write file
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            file_bytes = base64.b64decode(data_b64)
            dest_path.write_bytes(file_bytes)

            rel_path = str(dest_path.relative_to(BASE_DIR)).replace("\\", "/")
            self._send_json({"ok": True, "path": rel_path})
        except (KeyError, ValueError) as e:
            self._send_json({"error": str(e)}, 400)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    # ── Static file serving ───────────────────────────────────

    def _serve_static(self, path):
        clean = path.lstrip("/")
        if not clean:
            self._serve_file(BASE_DIR / "editor.html")
            return
        file_path = (BASE_DIR / clean).resolve()
        # Path traversal check
        if not str(file_path).startswith(str(BASE_DIR.resolve())):
            self.send_response(403)
            self.end_headers()
            return
        self._serve_file(file_path)

    def _serve_file(self, file_path):
        if not file_path.exists():
            self.send_response(404)
            self.end_headers()
            return
        mime, _ = mimetypes.guess_type(str(file_path))
        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime or "application/octet-stream")
        self.send_header("Content-Length", len(data))
        self.send_header("Cache-Control", "no-cache")
        self._add_cors_headers()
        self.end_headers()
        self.wfile.write(data)

    # ── Utilities ─────────────────────────────────────────────

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self._add_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _add_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, fmt, *args):
        print(f"  [{self.address_string()}] {fmt % args}")


def main():
    import sys
    # Fix console encoding for Windows
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    os.chdir(BASE_DIR)
    server = http.server.HTTPServer(("", PORT), EditorHandler)
    try:
        print("=" * 46)
        print("  ChiikawaAgileSurvival Content Editor")
        print(f"  http://localhost:{PORT}/editor.html")
        print("  Press Ctrl+C to stop")
        print("=" * 46)
    except UnicodeEncodeError:
        print(f"Editor running at http://localhost:{PORT}/editor.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    main()
