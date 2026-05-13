# AMAI custom-voice bridge

A small Python server that turns AMAI's text replies into audio in your custom RVC voice.

```
[ AMAI frontend ]  --POST text-->  [ this server ]  =  Edge-TTS  →  RVC  →  WAV
```

## Why a bridge?

RVC (`.pth` + `.index`) is a **voice conversion** model — it doesn't generate speech from text. It takes existing audio and morphs the voice. So this server first synthesizes neutral speech with **Microsoft Edge's free TTS**, then runs that audio through your RVC model to convert it to the target voice.

## Install

You need **Python 3.10 or 3.11** (NOT 3.12+) and **ffmpeg** on your PATH.

> **Why the Python version matters**: `rvc-python` pulls in `faiss-cpu==1.7.3`, `fairseq`, and a specific torch build. Wheels for these are only published for Python 3.10/3.11. If you try with 3.12+ you'll hit `Could not find a version that satisfies the requirement faiss-cpu==1.7.3`. Your system Python can stay whatever it is — we'll use the `py` launcher to point at the right one.

### 1. Install Python 3.10 (if you don't have it)

```powershell
winget install Python.Python.3.10
```

Verify the launcher sees it:
```powershell
py -0
```
You should see `-3.10-64` in the list.

### 2. Install ffmpeg (if you don't have it)

```powershell
winget install Gyan.FFmpeg
```
Then **open a fresh terminal** so the PATH update sticks.

### 3. Create the venv and run the installer

From this folder (`tts-rvc-server/`):

```powershell
py -3.10 -m venv .venv
.venv\Scripts\activate
python --version          # must report 3.10.x
install.bat
```

You also need **git** on PATH for the installer (`winget install Git.Git` if missing).

(macOS / Linux: replace `py -3.10` with `python3.10`, `.venv\Scripts\activate` with `source .venv/bin/activate`, and read `install.bat` as a list of `pip install` commands to run in order.)

> **Why a script and not `pip install -r requirements.txt`?** `rvc-python` pulls in `fairseq==0.12.2`, which pins `omegaconf==2.0.6` — that release has no wheels for any modern Python and fails to build from source. The standard RVC workaround is: install a maintained **fairseq fork** (omegaconf bumped) first, then `pip install rvc-python --no-deps`, then add the rest manually. `install.bat` does this in the right order.

GPU users: edit `install.bat` and change the torch line to a CUDA build (e.g. `--index-url https://download.pytorch.org/whl/cu121`), then pass `--device cuda:0` in `run.bat`.

## Run

The repo includes the Moka-Akashiya model under `../Mori Calliope Ai Model/`. The `run.bat` script points at it by default — just double-click it (or run from a terminal):

```bash
# from this folder
run.bat                                # Windows
# or directly:
python server.py \
  --model "../Mori Calliope Ai Model/Moka_AkashiyaENG(Outer_Persona)32k_e250_s10000.pth" \
  --index "../Mori Calliope Ai Model/added_IVF1107_Flat_nprobe_1_Moka_AkashiyaENG(Outer_Persona)32k_v2.index" \
  --voice en-US-AvaMultilingualNeural
```

First launch loads the model — takes ~30s on CPU. After that, each synthesis takes 1–4s on CPU, sub-second on GPU.

You should see:
```
[bridge] listening on http://127.0.0.1:5800/tts
```

Test it from another terminal:
```bash
curl -X POST -H "Content-Type: application/json" -d "{\"text\":\"hello world\"}" http://localhost:5800/tts -o test.wav
```

## Connect AMAI

In AMAI → **Vibe panel** → **Custom voice (TTS endpoint)**:
- **URL**: `http://localhost:5800/tts`
- **Body format**: `POST JSON`
- **Text param name**: `text`
- **Auth header**: leave blank
- Click **Test voice** — you should hear the converted voice.

Then turn on **Speak replies aloud** (same panel) and start chatting.

## Tuning

| Flag | What it does |
|---|---|
| `--voice` | Base TTS voice. Try `en-US-AvaMultilingualNeural`, `JennyNeural`, `AriaNeural`, `EmmaNeural`, or a Japanese voice like `ja-JP-NanamiNeural` if your model is JP. |
| `--pitch N` | Pitch shift in semitones. If the converted voice sounds too low/high, try `±2` or `±12` (one octave). |
| `--protect 0.33` | Voiceless-consonant protection. Lower = more conversion (riskier), higher = preserves original consonants. 0.33 is a safe default. |
| `--rate +10%` | Speed up / slow down base TTS. |
| `--device cuda:0` | Use GPU. Massively faster. |

## Troubleshooting

- **"missing text"** — your client is sending the wrong shape; verify Body format and Text param in AMAI match what `server.py` expects.
- **`ffmpeg not found`** — install ffmpeg and reopen the terminal.
- **Hangs on first synthesis** — model is loading; wait. After the first one, subsequent calls are fast.
- **Robotic / metallic output** — try a different `--voice` (closer in pitch range to the target) or adjust `--pitch`.
- **CORS errors in browser console** — `flask-cors` is installed; if you renamed the endpoint, restart the server.
- **Out of memory** — switch from `--device cuda:0` back to `--device cpu`.

## Stopping

`Ctrl+C` in the terminal. AMAI will silently fall back to its built-in browser voice.
