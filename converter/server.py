#!/usr/bin/env python3
"""Calibre ebook-convert HTTP sidecar for Epub converter."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_file

app = Flask(__name__)

PORT = int(os.environ.get("CONVERTER_PORT", "8090"))
TEMP_DIR = Path(os.environ.get("TEMP_DIR", "/tmp/epub-convert"))
TEMP_TTL = int(os.environ.get("TEMP_TTL_SECONDS", "3600"))
MAX_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "80"))
MAX_BYTES = MAX_MB * 1024 * 1024

TEMP_DIR.mkdir(parents=True, exist_ok=True)

# Format extension map (Calibre uses these suffixes)
INPUT_EXT = {
    "epub": ".epub",
    "pdf": ".pdf",
    "mobi": ".mobi",
    "azw3": ".azw3",
    "fb2": ".fb2",
    "txt": ".txt",
    "html": ".html",
    "markdown": ".md",
    "docx": ".docx",
    "rtf": ".rtf",
}

OUTPUT_EXT = {
    "epub": ".epub",
    "pdf": ".pdf",
    "mobi": ".mobi",
    "azw3": ".azw3",
    "fb2": ".fb2",
    "txt": ".txt",
    "html": ".htmlz",  # Calibre HTML package
    "docx": ".docx",
    "rtf": ".rtf",
}

# Back-compat alias used elsewhere
EXT = OUTPUT_EXT

PAGE_SIZES = {
    "a4": "a4",
    "letter": "letter",
    "a5": "a5",
    "legal": "legal",
}


def cleanup_loop() -> None:
    while True:
        now = time.time()
        try:
            for path in TEMP_DIR.iterdir():
                try:
                    age = now - path.stat().st_mtime
                    if age > TEMP_TTL:
                        if path.is_dir():
                            shutil.rmtree(path, ignore_errors=True)
                        else:
                            path.unlink(missing_ok=True)
                except OSError:
                    pass
        except OSError:
            pass
        time.sleep(60)


@app.get("/health")
def health():
    try:
        r = subprocess.run(
            ["ebook-convert", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        version = (r.stdout or r.stderr or "").strip().split("\n")[0]
        return jsonify(
            {
                "ok": True,
                "engine": "calibre",
                "version": version,
                "maxFileSizeMb": MAX_MB,
            }
        )
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 503


@app.get("/formats")
def formats():
    """Advertise supported formats (mirrors shared package)."""
    return jsonify(
        {
            "formats": list(EXT.keys()),
            "engine": "calibre",
            "notes": {
                "pdf": "PDF→ebook reflow quality varies by source layout",
                "html": "Output is Calibre HTMLZ (zipped HTML)",
                "markdown": "Input only — Calibre has no Markdown writer",
            },
        }
    )


def build_args(input_path: Path, output_path: Path, options: dict) -> list[str]:
    args = ["ebook-convert", str(input_path), str(output_path)]

    out_ext = output_path.suffix.lower()
    if out_ext == ".pdf":
        page = PAGE_SIZES.get(str(options.get("pdfPageSize", "a4")).lower(), "a4")
        args += ["--paper-size", page]
        for key, flag in (
            ("marginTop", "--pdf-page-margin-top"),
            ("marginBottom", "--pdf-page-margin-bottom"),
            ("marginLeft", "--pdf-page-margin-left"),
            ("marginRight", "--pdf-page-margin-right"),
        ):
            if key in options and options[key] is not None:
                try:
                    args += [flag, str(int(options[key]))]
                except (TypeError, ValueError):
                    pass
        if options.get("toc"):
            args += ["--pdf-add-toc"]
        if options.get("embedFonts"):
            args += ["--embed-all-fonts"]

    # Shared ConversionOptions → Calibre flags (presets fill these)
    if options.get("imageQuality") is not None:
        try:
            args += ["--jpegquality", str(int(options["imageQuality"]))]
        except (TypeError, ValueError):
            pass
    profile = options.get("outputProfile")
    if profile:
        args += ["--output-profile", str(profile)]

    return args



@app.post("/convert")
def convert():
    if "file" not in request.files:
        return jsonify({"error": "Missing file field"}), 400

    upload = request.files["file"]
    if not upload or not upload.filename:
        return jsonify({"error": "Empty filename"}), 400

    to_format = (request.form.get("to") or "").lower().strip()
    from_format = (request.form.get("from") or "").lower().strip()

    if to_format not in OUTPUT_EXT:
        return jsonify({"error": f"Unsupported output format: {to_format}"}), 400
    if from_format and from_format not in INPUT_EXT:
        return jsonify({"error": f"Unsupported input format: {from_format}"}), 400
    if to_format == "markdown":
        return jsonify({"error": "Markdown output is not supported by Calibre"}), 400

    # Parse options JSON if present
    options: dict = {}
    raw_opts = request.form.get("options")
    if raw_opts:
        import json

        try:
            options = json.loads(raw_opts)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid options JSON"}), 400

    job_id = str(uuid.uuid4())
    work = TEMP_DIR / job_id
    work.mkdir(parents=True, exist_ok=True)

    try:
        # Determine input extension
        original = Path(upload.filename).name
        in_ext = Path(original).suffix.lower()
        if from_format:
            in_ext = INPUT_EXT[from_format]
        elif not in_ext:
            return jsonify({"error": "Cannot detect input format"}), 400

        input_path = work / f"input{in_ext}"
        upload.save(input_path)

        size = input_path.stat().st_size
        if size > MAX_BYTES:
            shutil.rmtree(work, ignore_errors=True)
            return jsonify({"error": f"File exceeds {MAX_MB}MB limit"}), 413
        if size == 0:
            shutil.rmtree(work, ignore_errors=True)
            return jsonify({"error": "Empty file"}), 400

        # Markdown: Calibre prefers .md or convert via html — .md works in modern Calibre
        output_path = work / f"output{OUTPUT_EXT[to_format]}"

        args = build_args(input_path, output_path, options)
        env = os.environ.copy()
        env.setdefault(
            "QTWEBENGINE_CHROMIUM_FLAGS",
            "--no-sandbox --disable-gpu --disable-dev-shm-usage",
        )
        # Prefer real Xvfb display from entrypoint for PDF; offscreen for others
        if output_path.suffix.lower() == ".pdf":
            env["DISPLAY"] = env.get("DISPLAY", ":99")
            env.pop("QT_QPA_PLATFORM", None)
        else:
            env.setdefault("QT_QPA_PLATFORM", "offscreen")
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=600,
            env=env,
        )

        if result.returncode != 0 or not output_path.exists():
            err = (result.stderr or result.stdout or "Conversion failed").strip()
            # Keep work dir briefly for debug; still clean soon via TTL
            return (
                jsonify(
                    {
                        "error": "Conversion failed",
                        "detail": err[-4000:],
                        "jobId": job_id,
                    }
                ),
                500,
            )

        download_name = Path(original).stem + OUTPUT_EXT[to_format]
        mime = {
            ".epub": "application/epub+zip",
            ".pdf": "application/pdf",
            ".mobi": "application/x-mobipocket-ebook",
            ".azw3": "application/vnd.amazon.ebook",
            ".fb2": "application/x-fictionbook+xml",
            ".txt": "text/plain",
            ".htmlz": "application/zip",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".rtf": "application/rtf",
        }.get(OUTPUT_EXT[to_format], "application/octet-stream")

        response = send_file(
            output_path,
            mimetype=mime,
            as_attachment=True,
            download_name=download_name,
        )
        response.headers["X-Job-Id"] = job_id

        # Schedule cleanup of this job dir after response
        def _cleanup():
            time.sleep(2)
            shutil.rmtree(work, ignore_errors=True)

        threading.Thread(target=_cleanup, daemon=True).start()
        return response
    except subprocess.TimeoutExpired:
        shutil.rmtree(work, ignore_errors=True)
        return jsonify({"error": "Conversion timed out"}), 504
    except Exception as e:
        shutil.rmtree(work, ignore_errors=True)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    threading.Thread(target=cleanup_loop, daemon=True).start()
    app.run(host="0.0.0.0", port=PORT, threaded=True)
