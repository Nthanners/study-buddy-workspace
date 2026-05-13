@echo off
REM ============================================================================
REM  AMAI custom-voice bridge — staged installer
REM
REM  Why staged?  rvc-python pulls in fairseq==0.12.2, which pins an ancient
REM  omegaconf==2.0.6 with no wheel for modern Python.  We install a maintained
REM  fairseq fork (omegaconf bumped) FIRST, then rvc-python WITHOUT its deps,
REM  then add the rest manually.  This is the standard RVC workaround.
REM
REM  Run this from inside an activated Python 3.10 venv:
REM      py -3.10 -m venv .venv
REM      .venv\Scripts\activate
REM      install.bat
REM ============================================================================

where git >nul 2>&1 || (echo ERROR: git is not on PATH. Install git first. & exit /b 1)

echo.
echo [1/5] Upgrading pip + build tools...
python -m pip install --upgrade pip setuptools wheel || exit /b 1

echo.
echo [2/5] Installing torch ^(CPU build^)...
pip install torch==2.1.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cpu || exit /b 1

echo.
echo [3/5] Installing fairseq fork ^(modern omegaconf^)...
pip install --no-cache-dir git+https://github.com/IAHispano/fairseq.git || exit /b 1

echo.
echo [4/5] Installing audio + RVC stack...
pip install numpy==1.23.5 scipy==1.11.4 librosa==0.10.1 pyworld praat-parselmouth ^
            soundfile tqdm scikit-learn onnxruntime faiss-cpu==1.7.3 ^
            tensorboardX matplotlib resampy joblib audioread pydub ffmpeg-python ^
            ffmpy local-attention einops pyngrok || exit /b 1

echo.
echo [5/5] Installing rvc-python ^(no deps^) + bridge deps...
pip install --no-deps rvc-python || exit /b 1
pip install flask flask-cors edge-tts || exit /b 1

echo.
echo ============================================================================
echo  Done. Now run:    run.bat
echo ============================================================================
