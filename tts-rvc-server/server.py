"""
AMAI custom-voice bridge server.

Pipeline:  text  →  Edge-TTS (base voice)  →  RVC (target voice)  →  WAV out

Endpoint:
    POST /tts     JSON {"text": "..."}        → audio/wav
    POST /tts     raw text body (text/plain)  → audio/wav
    GET  /tts?text=...                        → audio/wav
    GET  /health                              → {"ok": true}

Run:
    pip install -r requirements.txt
    python server.py --model "../Mori Calliope Ai Model/Moka_AkashiyaENG(Outer_Persona)32k_e250_s10000.pth" \
                     --index "../Mori Calliope Ai Model/added_IVF1107_Flat_nprobe_1_Moka_AkashiyaENG(Outer_Persona)32k_v2.index"

Then in AMAI → Vibe panel → Custom voice (TTS endpoint):
    URL          : http://localhost:5800/tts
    Body format  : POST JSON
    Text param   : text
"""
import argparse
import asyncio
import os
import sys
import tempfile
import threading
import traceback

# rvc-python requires Python 3.10 or 3.11 — its deep-learning stack
# (faiss-cpu==1.7.3, fairseq, torch 2.1.x) has no wheels for 3.12+.
if sys.version_info < (3, 10) or sys.version_info >= (3, 12):
    sys.exit(
        f"ERROR: this server requires Python 3.10 or 3.11 (you're on "
        f"{sys.version_info.major}.{sys.version_info.minor}).\n"
        f"Install 3.10 (winget install Python.Python.3.10), then recreate the venv:\n"
        f"  py -3.10 -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements.txt"
    )

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS

try:
    import edge_tts
except ImportError:
    sys.exit("ERROR: edge-tts not installed.  pip install edge-tts")

try:
    from rvc_python.infer import RVCInference
except ImportError:
    sys.exit(
        "ERROR: rvc-python not installed.  pip install rvc-python\n"
        "If install fails, you may need: pip install torch torchaudio fairseq faiss-cpu"
    )


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True, help="Path to the RVC .pth model file")
    p.add_argument("--index", default=None, help="Path to the RVC .index file (recommended)")
    p.add_argument(
        "--voice",
        default="en-US-AvaMultilingualNeural",
        help="Edge-TTS base voice. Try AvaMultilingualNeural / JennyNeural / AriaNeural / EmmaNeural.",
    )
    p.add_argument("--device", default="cpu", help="cpu | cuda:0 (much faster on GPU)")
    p.add_argument("--pitch", type=int, default=0, help="Pitch shift in semitones (default 0)")
    p.add_argument(
        "--protect",
        type=float,
        default=0.33,
        help="RVC voiceless-consonant protection 0..0.5 (default 0.33)",
    )
    p.add_argument("--rate", default="+0%", help="Edge-TTS rate, e.g. +10%, -5%")
    p.add_argument("--port", type=int, default=5800)
    p.add_argument("--host", default="127.0.0.1")
    return p.parse_args()


def main():
    args = parse_args()

    if not os.path.exists(args.model):
        sys.exit(f"ERROR: model file not found: {args.model}")

    print(f"[bridge] device      : {args.device}")
    print(f"[bridge] base voice  : {args.voice}")
    print(f"[bridge] RVC model   : {args.model}")
    print(f"[bridge] RVC index   : {args.index or '(none)'}")
    print(f"[bridge] pitch shift : {args.pitch} semitones")
    print(f"[bridge] loading RVC model — first time can take ~30 seconds…")

    rvc = RVCInference(device=args.device)
    # rvc-python accepts either `index` or `index_path` depending on version
    try:
        rvc.load_model(args.model, index=args.index)
    except TypeError:
        rvc.load_model(args.model, index_path=args.index)
    try:
        rvc.set_params(f0up_key=args.pitch, protect=args.protect)
    except Exception:
        # Older versions expose attrs directly
        try:
            rvc.f0up_key = args.pitch
            rvc.protect = args.protect
        except Exception:
            pass

    print("[bridge] model ready.")

    app = Flask(__name__)
    CORS(app)

    # RVC inference is not safe to call concurrently — serialize.
    inference_lock = threading.Lock()

    async def _edge_tts_to_file(text: str, out_path: str) -> None:
        comm = edge_tts.Communicate(text, args.voice, rate=args.rate)
        await comm.save(out_path)

    def synthesize(text: str) -> str:
        """text → out.wav path (caller owns the file's parent tempdir)."""
        td = tempfile.mkdtemp(prefix="amai_tts_")
        base_path = os.path.join(td, "base.mp3")
        out_path = os.path.join(td, "out.wav")

        # Step 1: base TTS via Microsoft Edge voices (free, no API key)
        asyncio.run(_edge_tts_to_file(text, base_path))

        # Step 2: convert to target voice via RVC
        with inference_lock:
            rvc.infer_file(base_path, out_path)

        return out_path

    def respond_with_audio(out_path: str):
        # send_file streams the file then we delete its tempdir.
        @app.after_this_request
        def _cleanup(resp):
            try:
                td = os.path.dirname(out_path)
                for f in os.listdir(td):
                    try:
                        os.remove(os.path.join(td, f))
                    except OSError:
                        pass
                os.rmdir(td)
            except OSError:
                pass
            return resp

        return send_file(out_path, mimetype="audio/wav", as_attachment=False)

    @app.get("/health")
    def health():
        return jsonify(ok=True, device=args.device, voice=args.voice)

    @app.route("/tts", methods=["GET", "POST"])
    def tts():
        # Pull text from any of the supported shapes
        text = ""
        if request.method == "GET":
            text = (request.args.get("text") or "").strip()
        else:
            ctype = (request.content_type or "").lower()
            if "application/json" in ctype:
                data = request.get_json(silent=True) or {}
                text = (data.get("text") or "").strip()
            elif "text/plain" in ctype:
                text = (request.get_data(as_text=True) or "").strip()
            else:
                # Try query string as last resort
                text = (request.args.get("text") or "").strip()

        if not text:
            return jsonify(error="missing 'text'"), 400
        # Cap to avoid runaway syntheses
        text = text[:1000]

        try:
            out_path = synthesize(text)
        except Exception as e:
            traceback.print_exc()
            return jsonify(error=f"synthesis failed: {e}"), 500

        return respond_with_audio(out_path)

    print(f"[bridge] listening on http://{args.host}:{args.port}/tts")
    app.run(host=args.host, port=args.port, threaded=True)


if __name__ == "__main__":
    main()
