# whisper-dictation — installation Linux (Bazzite, distrobox `dev`)

Notes d'installation sur un poste Fedora Atomic (Bazzite, KDE Plasma Wayland),
l'appli tournant dans une distrobox `dev`, whisper.cpp compilé pour le GPU
(Vulkan). Outil de confort : rien ici ne fait partie de la recette de la box
`dev` (`dev.ini`).

Tout se fait **dans la box `dev`**.

## Lancer

```bash
whisper
```

Alias de `~/.bashrc` vers `~/dev/Gear/tools/whisper.sh`, utilisable depuis
l'hôte comme depuis la box (il entre dans `dev` si besoin). L'appli part en
arrière-plan ; relancé, il dit « whisper tourne déjà ».

Maintenir le clic sur l'icône, parler, relâcher : le texte arrive dans le
presse-papiers, **Ctrl+V** pour le coller (Ctrl+Maj+V dans un terminal).

Une bulle montre aussi le texte à côté de l'icône pendant 10 s (le survol
suspend ce délai ; la croix la ferme). **Un clic dessus le recopie** : pratique
si on a copié autre chose entre-temps. Désactivable : clic droit → *Afficher le texte transcrit*
(clé `showText` de `.data/config.json`).

En appel Discord : clic droit → *Autoriser la coupure du micro Discord* pour que
le salon n'entende pas la dictée (micro coupé le temps de l'enregistrement,
puis rétabli ; un micro déjà coupé le reste). Coupure invisible côté Discord
(ni icône ni son) : la bulle *Micro Discord coupé* la signale. Passe par
`wpctl`, déjà présent dans la box (paquet `wireplumber`) : rien à installer.

Lecture à voix haute : sélectionner du texte n'importe où, puis clic sur le
petit bouton ▶ à droite de l'icône (grisé s'il n'y a rien de sélectionné ;
■ pendant la lecture, un clic arrête). Voix française Piper, sur le processeur,
moins d'1 s de préparation. Français et anglais détectés phrase par phrase,
chacun lu par sa voix. Clic droit → *Lecture à voix haute* pour lire le
presse-papiers à la place, masquer le bouton, imposer une langue, changer de
voix, régler le volume (curseur) ou compléter la prononciation des mots
anglais (clé `pronunciations` de `.data/config.json`).

Arrêter : clic droit → *Quitter*.

## Mettre à jour

```bash
cd ~/dev/Gear/tools/whisper-dictation
git pull --ff-only
npm install                              # seulement si package.json a changé
node node_modules/electron/install.js    # idem, si la version d'Electron a changé
```

Puis clic droit → *Quitter* et relancer `whisper` : tant que l'appli tourne, le
lanceur ne fait rien. `.data/`, exclu de git, ne gêne pas le `pull`.

## Où est quoi

| Quoi | Où |
|---|---|
| Appli (Electron) | `~/dev/Gear/tools/whisper-dictation` |
| Données de l'appli | `.data/` (au lieu de `~/.config/whisper-dictation`) |
| Modèle + enveloppe `whisper-cli` | `.data/whisper/` |
| Piper (synthèse vocale) | `~/.local/bin/piper` (outil `uv`) |
| Voix Piper | `.data/piper/` : `fr_FR-upmc-medium` (jessica, pierre), `fr_FR-siwis-medium`, `en_US-lessac-high`, `en_US-ryan-high` (`.onnx` + `.onnx.json`) |
| Config (langue, vocabulaire, micro) | `.data/config.json` |
| whisper.cpp | `~/dev/Gear/tools/whisper.cpp` — `build-vulkan/` (GPU, utilisé), `build/` (CPU, secours) |
| Lanceur | `~/dev/Gear/tools/whisper.sh` |
| Journal | `~/.cache/whisper-dictation.log` |

## Paquets dnf de la box

Installés à la main, **volontairement absents de `dev.ini`** : à réinstaller
après une recréation de la box.

```bash
sudo dnf install -y glslc vulkan-headers vulkan-loader-devel spirv-headers-devel
```

Ils ne servent qu'à **compiler** whisper.cpp en Vulkan (GPU). Le binaire
compilé, lui, n'a besoin que de ce que `dev.ini` fournit déjà (`vulkan-loader`,
`nvidia=true`) : la box recréée, whisper tourne sans eux.

## Choix non évidents

- **`.data/`** : le lanceur passe `--user-data-dir=.data` à Electron, pour garder
  modèle, config et caches dans le projet plutôt que dans
  `~/.config/whisper-dictation`. Ignoré par git via `.git/info/exclude`.
- **`whisper-cli` est un script, pas un lien** : l'appli ne reconnaît qu'un
  fichier ordinaire. Le script appelle le binaire de `build-vulkan/` avec
  `-t 8` (4 threads par défaut). Retour au CPU : remplacer `build-vulkan` par
  `build` dedans.
- **Collage manuel** : l'appli sait envoyer Ctrl+V seule (`xdotool`, `wtype`,
  `ydotool`), mais sous KDE Wayland seul `ydotool` marche, et il faut son démon
  sur l'hôte. Écarté pour l'instant. Pour y revenir : `ydotoold` est fourni par
  Bazzite, `/dev/uinput` est déjà accessible sans root → service utilisateur
  sur l'hôte avec `--socket-path=%t/.ydotool_socket`, paquet `ydotool` dans la
  box, et `YDOTOOL_SOCKET` exporté par le lanceur.
- **Piper par `uv tool`**, pas par `dnf` : il vit dans le home et survit à la
  recréation de la box. Désinstaller : `uv tool uninstall piper-tts`.
- **Voix** : deux par langue, choisies à l'écoute. Français : `upmc` (jessica
  par défaut, pierre pour une voix d'homme) et `siwis`, en qualité moyenne —
  il n'en existe pas de haute en français. Anglais : `lessac` et `ryan` en
  qualité haute (~115 Mo chacune, ~1,1 s par lecture au lieu de ~0,7 s).
  D'autres sur le même dépôt Hugging Face (`ljspeech-high`, `en_GB-cori-high`…).
  Les voix anglaises lisant du français (et l'inverse) ont été essayées :
  inutilisable, d'où le basculement de voix phrase par phrase.
- **Processeur, pas GPU** : Piper lit 15 s de texte en 0,2 s sur le
  processeur ; le délai ressenti (~0,5 s) est le chargement de la voix à
  chaque clic, que le GPU ne réduirait pas. Le passer au GPU demanderait
  `onnxruntime-gpu` et les bibliothèques CUDA dans la box, pour rien.
- **Sélection** : l'appli lit la sélection « primaire » de Linux (ce qui est
  surligné, sans Ctrl+C). Certaines applications la gardent après qu'on a
  cliqué ailleurs : le bouton reste alors actif sur l'ancienne sélection.
- **`wl-paste` de l'hôte** : Electron tourne en X11 (XWayland), et KWin ne
  passe la sélection à une fenêtre X11 que si elle a le focus — l'icône ne le
  prend jamais. L'appli lit donc la sélection par `wl-paste`, pris sur l'hôte
  (`/run/host/usr/bin/wl-paste`, fourni par Bazzite) : rien à installer dans
  la box. Quand Klipper remplit une sélection vidée, il la marque
  `application/x-kde-onlyReplaceEmpty` : l'appli la tient pour vide.
- **Modèle** `ggml-large-v3-turbo-q5_0.bin` (548 Mo) : bon en français.
  ~0,3 s par dictée sur la RTX 5070 Ti (~4,5 s en CPU) ; le tout premier appel
  prend ~4 s (compilation des shaders, ensuite en cache). ~600 Mo de VRAM,
  seulement pendant la transcription.

## Réinstaller de zéro

```bash
cd ~/dev/Gear/tools

# 1. L'appli
git clone https://github.com/SoutadeJulien/whisper-dictation.git
cd whisper-dictation
npm install
node node_modules/electron/install.js   # npm bloque le postinstall d'Electron
echo '.data/' >> .git/info/exclude
cd ..

# 2. whisper.cpp en GPU (après les paquets dnf ci-dessus)
git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
cmake -B build-vulkan -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
      -DGGML_NATIVE=ON -DGGML_VULKAN=ON -DWHISPER_BUILD_TESTS=OFF
cmake --build build-vulkan -j16 --target whisper-cli
cd ..

# 3. Modèle + enveloppe
mkdir -p whisper-dictation/.data/whisper && cd whisper-dictation/.data/whisper
curl -fLO https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
printf '#!/bin/sh\nexec %s/dev/Gear/tools/whisper.cpp/build-vulkan/bin/whisper-cli -t 8 "$@"\n' "$HOME" > whisper-cli
chmod +x whisper-cli
cd ../../..

# 4. Lecture à voix haute : Piper + une voix française
uv tool install piper-tts
mkdir -p whisper-dictation/.data/piper && cd whisper-dictation/.data/piper
V=https://huggingface.co/rhasspy/piper-voices/resolve/main
for v in fr/fr_FR/upmc/medium/fr_FR-upmc-medium fr/fr_FR/siwis/medium/fr_FR-siwis-medium \
         en/en_US/lessac/high/en_US-lessac-high en/en_US/ryan/high/en_US-ryan-high; do
  curl -fLO "$V/$v.onnx" && curl -fLO "$V/$v.onnx.json"
done
```

Puis le lanceur `~/dev/Gear/tools/whisper.sh` (à rendre exécutable :
`chmod +x`) :

```bash
#!/bin/bash
# Lance whisper-dictation (icône de dictée flottante) en arrière-plan.
# Utilisable depuis l'hôte comme depuis la box : l'appli tourne toujours dans `dev`.
# Journal : ~/.cache/whisper-dictation.log
set -e

if [ ! -f /run/.containerenv ]; then
  exec distrobox enter dev -- "$0" "$@"
fi

APP="$HOME/dev/Gear/tools/whisper-dictation"

if pgrep -f "$APP/node_modules/electron/dist/electron" >/dev/null; then
  echo "whisper tourne déjà."
  exit 0
fi

cd "$APP"
setsid nohup "$APP/node_modules/.bin/electron" . --user-data-dir="$APP/.data" >~/.cache/whisper-dictation.log 2>&1 < /dev/null &
echo "whisper lancé (journal : ~/.cache/whisper-dictation.log)."
```

Et l'alias dans `~/.bashrc` :

```bash
alias whisper="$HOME/dev/Gear/tools/whisper.sh"
```
