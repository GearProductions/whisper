"""Chatterbox (Resemble AI) en service HTTP local, pour whisper-dictation.

Moteur « GPU » de la lecture à voix haute : plus naturel que Pocket TTS, au
prix de ~3,7 Go de mémoire vidéo. Le modèle n'est chargé qu'à la demande et
libéré après IDLE_S sans lecture : le GPU reste à ComfyUI ou gear-ai-worker le
reste du temps.

Au démarrage, une génération d'essai paie une fois pour toutes la mise en
route du processus (~17 s de compilations au premier usage), puis libère la
VRAM : ensuite, un chargement ne coûte plus que ~5 s.

Les voix sont celles de Pocket TTS, clonées à partir des mêmes enregistrements
Kyutai (copiés dans l'image, cf. Containerfile) : mêmes noms, mêmes timbres,
quel que soit le moteur.

  GET  /health                       {"loaded": bool, "voices": [...]}
  POST /warm   {"lang", "voice"}     charge modèle et voix d'avance
  POST /speak  {"text", "lang", "voice"}
       → X-Sample-Rate, puis des trames [longueur u32 LE][PCM 16 bits mono],
         une par morceau de texte (~une phrase) : la lecture commence dès la
         première. Une requête abandonnée arrête la génération au morceau
         suivant.
"""

import gc
import os
import re
import struct
import threading
import time

import torch
from chatterbox.models.s3gen import S3GEN_SR
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

IDLE_S = int(os.environ.get("CHATTERBOX_IDLE_S", "600"))
MAX_CHUNK = 250  # caractères : au-delà, Chatterbox dérive ou coupe
FIRST_CHUNK = 80  # ~5 s de voix, générés en ~1 s
FIRST_MIN = 40    # « Bonjour ! » seul laisserait un blanc avant la suite
MAX_CHARS = 20000

# Enregistrement de référence et langue qu'on y parle, par voix.
VOICES = {
    "estelle": ("estelle.wav", "fr"),
    "mary": ("mary.wav", "en"),
    "marius": ("marius.wav", "en"),
    "alba": ("alba.wav", "en"),
    "jane": ("jane.wav", "en"),
    "george": ("george.wav", "en"),
}
VOICES_DIR = "/voices"

# Style par langue. Le français sortait monotone : plus d'expressivité, et un
# guidage plus bas pour un débit plus posé (choisis à l'écoute).
STYLES = {
    "fr": {"exaggeration": 1.2, "cfg_weight": 0.3},
    "en": {"exaggeration": 0.5, "cfg_weight": 0.5},
}
DEFAULT_STYLE = {"exaggeration": 0.5, "cfg_weight": 0.5}

app = FastAPI()
lock = threading.Lock()  # une génération à la fois (le modèle n'est pas réentrant)
model = None
conds = {}  # voix -> conditionnement préparé
last_use = time.monotonic()


def load(voice):
    """Modèle et conditionnement de `voice`, chargés au besoin. Sous `lock`."""
    global model
    if model is None:
        model = ChatterboxMultilingualTTS.from_pretrained(device="cuda")
    if voice not in conds:
        model.prepare_conditionals(os.path.join(VOICES_DIR, VOICES[voice][0]))
        conds[voice] = model.conds
    model.conds = conds[voice]
    return model


def unload():
    """Libère la VRAM. Sous `lock`."""
    global model
    model = None
    conds.clear()
    gc.collect()
    torch.cuda.empty_cache()


def warm_process():
    with lock:
        load("estelle").generate("Bonjour.", language_id="fr")
        unload()


def unload_when_idle():
    while True:
        time.sleep(30)
        with lock:
            if model is not None and time.monotonic() - last_use > IDLE_S:
                unload()


threading.Thread(target=warm_process, daemon=True).start()
threading.Thread(target=unload_when_idle, daemon=True).start()


def chunks(text):
    """Morceaux à générer un par un : des phrases (trop longues : coupées entre
    propositions, sinon entre mots), regroupées jusqu'à MAX_CHUNK caractères.
    Le premier est court (FIRST_CHUNK) : la lecture démarre dès qu'il est prêt,
    la suite se génère plus vite qu'elle ne s'écoute."""
    units = []
    for para in re.split(r"\n\s*\n", text):
        for sentence in re.split(r"(?<=[.!?…])\s+", " ".join(para.split())):
            pieces = re.split(r"(?<=[,;:])\s+", sentence) if len(sentence) > MAX_CHUNK else [sentence]
            for piece in pieces:
                while len(piece) > MAX_CHUNK:
                    cut = piece.rfind(" ", 0, MAX_CHUNK)
                    cut = cut if cut > 0 else MAX_CHUNK
                    units.append(piece[:cut])
                    piece = piece[cut:].strip()
                if piece:
                    units.append(piece)
    out, cur = [], ""
    for unit in units:
        limit = MAX_CHUNK if out else FIRST_CHUNK
        if cur and len(cur) + 1 + len(unit) > limit and (out or len(cur) >= FIRST_MIN):
            out.append(cur)
            cur = unit
        else:
            cur = f"{cur} {unit}".strip()
    if cur:
        out.append(cur)
    return out


class Voice(BaseModel):
    lang: str = "fr"
    voice: str = "estelle"


class Speech(Voice):
    text: str


def check(req: Voice):
    if req.voice not in VOICES:
        raise HTTPException(400, f"voix inconnue : {req.voice}")
    if req.lang not in ChatterboxMultilingualTTS.get_supported_languages():
        raise HTTPException(400, f"langue non prise en charge : {req.lang}")


@app.get("/health")
def health():
    return {"loaded": model is not None, "voices": list(VOICES)}


@app.post("/warm")
def warm(req: Voice):
    check(req)
    global last_use
    with lock:
        load(req.voice)
        last_use = time.monotonic()
    return {"ok": True}


@app.post("/speak")
async def speak(req: Speech, request: Request):
    check(req)
    pieces = chunks(req.text[:MAX_CHARS])
    if not pieces:
        raise HTTPException(400, "rien à lire")
    style = dict(STYLES.get(req.lang, DEFAULT_STYLE))
    # Référence dans une autre langue que le texte : sans guidage (cfg 0),
    # l'accent de la référence passe moins (recommandation de Resemble).
    if VOICES[req.voice][1] != req.lang:
        style["cfg_weight"] = 0.0

    def generate(piece):
        global last_use
        with lock:
            m = load(req.voice)
            wav = m.generate(piece, language_id=req.lang, **style)
            last_use = time.monotonic()
        pcm = (wav.squeeze(0).clamp(-1, 1) * 32767).to(torch.int16).cpu().numpy().tobytes()
        return struct.pack("<I", len(pcm)) + pcm

    first = await run_in_threadpool(generate, pieces[0])

    async def stream():
        yield first
        for piece in pieces[1:]:
            if await request.is_disconnected():
                return
            yield await run_in_threadpool(generate, piece)

    return StreamingResponse(stream(), media_type="application/octet-stream",
                             headers={"X-Sample-Rate": str(S3GEN_SR)})
