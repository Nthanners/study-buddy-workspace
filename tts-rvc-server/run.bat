@echo off
REM Convenience launcher for the AMAI custom-voice bridge.
REM Edit the MODEL / INDEX paths below if you place the model elsewhere.

set "MODEL=..\Mori Calliope Ai Model\Moka_AkashiyaENG(Outer_Persona)32k_e250_s10000.pth"
set "INDEX=..\Mori Calliope Ai Model\added_IVF1107_Flat_nprobe_1_Moka_AkashiyaENG(Outer_Persona)32k_v2.index"

REM Pitch shift in semitones — RVC sounds best when the base voice's pitch
REM is in the same range as the target. Adjust if the result sounds off.
set "PITCH=0"

REM Base voice. Try AvaMultilingualNeural / JennyNeural / AriaNeural / EmmaNeural.
set "VOICE=en-US-AvaMultilingualNeural"

python server.py --model "%MODEL%" --index "%INDEX%" --voice %VOICE% --pitch %PITCH% --device cpu
