"""Whisper — synthèse vocale Pocket TTS (Kyutai), processus permanent.

Lancé par tts.js avec le Python de l'installation de pocket-tts. Garde modèles
et voix en mémoire d'une lecture à l'autre, et renvoie l'audio par morceaux au
fil de la génération.

Commandes sur stdin, une ligne JSON chacune :
  {"id": 1, "text": "…", "model": "french_24l", "voice": "estelle"}
  {"cancel": 1}
  {"warm": "french_24l", "voice": "estelle"}   charger d'avance, sans réponse
Réponses sur stdout, une ligne JSON d'en-tête, suivie d'octets s'il y en a :
  {"id": 1, "rate": 24000, "bytes": N}   puis N octets PCM 16 bits mono
  {"id": 1, "done": true}  ou  {"id": 1, "error": "…"}
"""

import json
import queue
import sys
import threading

# stdout porte le protocole : tout print() égaré (bibliothèques) part sur stderr.
out = sys.stdout.buffer
sys.stdout = sys.stderr

import numpy as np  # noqa: E402
from pocket_tts import TTSModel  # noqa: E402
from pocket_tts.utils.utils import get_predefined_voice  # noqa: E402

lock = threading.Lock()


def send(msg, data=b""):
    with lock:
        out.write((json.dumps(msg) + "\n").encode())
        out.write(data)
        out.flush()


jobs = queue.Queue()
stops = {}  # id -> threading.Event


# Lu à part : une annulation doit arriver PENDANT une génération.
def read_commands():
    for line in sys.stdin:
        try:
            cmd = json.loads(line)
        except ValueError:
            continue
        if "cancel" in cmd:
            stop = stops.get(cmd["cancel"])
            if stop:
                stop.set()
        elif "warm" in cmd:
            jobs.put(cmd)
        elif "id" in cmd:
            stops[cmd["id"]] = threading.Event()
            jobs.put(cmd)
    jobs.put(None)  # stdin fermé : l'appli est partie


threading.Thread(target=read_commands, daemon=True).start()

models = {}
voices = {}


def load(name, voice):
    if name not in models:
        # int8 : ~2,7 fois plus rapide sur processeur, sans perte audible.
        models[name] = TTSModel.load_model(language=name, quantize=True)
    # Voix fournies toutes prêtes par Kyutai, une par modèle.
    if (name, voice) not in voices:
        voices[name, voice] = models[name].get_state_for_audio_prompt(get_predefined_voice(name, voice))
    return models[name], voices[name, voice]


while (cmd := jobs.get()) is not None:
    if "warm" in cmd:
        try:
            load(cmd["warm"], cmd["voice"])
        except Exception as err:  # noqa: BLE001 — la vraie lecture dira l'erreur
            print(f"préchargement : {err}", file=sys.stderr)
        continue
    job, stop = cmd["id"], stops[cmd["id"]]
    try:
        if not stop.is_set():
            model, voice = load(cmd["model"], cmd["voice"])
            for chunk in model.generate_audio_stream(voice, cmd["text"], stop=stop):
                pcm = (np.clip(chunk.numpy(), -1, 1) * 32767).astype("<i2").tobytes()
                send({"id": job, "rate": model.sample_rate, "bytes": len(pcm)}, pcm)
        send({"id": job, "done": True})
    except Exception as err:  # noqa: BLE001 — tout échec est rapporté à l'appli
        send({"id": job, "error": f"{type(err).__name__}: {err}"})
    finally:
        stops.pop(job, None)
