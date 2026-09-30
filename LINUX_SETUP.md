# whisper-dictation — installation Linux (Bazzite, distrobox `dev`)

Notes d'installation sur un poste Fedora Atomic (Bazzite, KDE Plasma Wayland),
l'appli tournant dans une distrobox `dev`, whisper.cpp compilé pour le GPU
(Vulkan). Outil de confort : rien ici ne fait partie de la recette de la box
`dev` (`dev.ini`).

Tout se fait **dans la box `dev`**.

Deux versions coexistent sur ce poste :

| Commande | Version | Où elle tourne | Données |
|---|---|---|---|
| `whisper-dev` | celle du projet (sources, cette branche) | box `dev` | `whisper-dictation/.data/` |
| `whisper` | la version publiée (AppImage des [Releases](https://github.com/GearProductions/whisper/releases)) | **hôte** | `~/.config/whisper-dictation/` |

L'AppImage est un paquet autonome : elle tourne sur l'hôte Bazzite telle
quelle (FUSE 2, `wl-paste` et `wpctl` y sont d'origine), sans rien de la box,
et télécharge elle-même ses modèles au premier usage. Ce qui suit est
l'installation de développement, depuis les sources.

## Lancer

```bash
whisper-dev     # version du projet
whisper         # version publiée
```

Alias de `~/.bashrc`, utilisables depuis l'hôte comme depuis la box :

- `whisper-dev` → `~/dev/Gear/tools/whisper.sh`, qui entre dans `dev` si besoin ;
- `whisper` → `~/dev/Gear/tools/whisper-appimage.sh`, qui ressort sur l'hôte si
  besoin et lance `whisper-dictation.AppImage` (lien vers la dernière version
  téléchargée à côté : `ln -sfn whisper-dictation-X.Y.Z-linux.AppImage
  whisper-dictation.AppImage` pour en changer).

L'appli part en arrière-plan ; relancé, le lanceur dit « whisper tourne déjà ».
Les deux versions peuvent tourner ensemble (deux icônes) : mieux vaut n'en
garder qu'une.

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
■ pendant la lecture, un clic arrête). Pocket TTS (Kyutai), sur le processeur :
la voix démarre ~0,1 s après le clic. Texte lu en français ou en anglais
selon sa langue. Clic droit → *Lecture à voix haute* pour lire le
presse-papiers à la place, masquer le bouton, imposer une langue, changer de
voix ou régler le volume (curseur). *Moteur → Chatterbox (GPU)* : voix plus
naturelles, par le service `dev-chatterbox` (quadlet podman sur l'hôte, cf.
`chatterbox/README.md`).

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
| Pocket TTS (synthèse vocale) | `~/.local/bin/pocket-tts` (outil `uv`) |
| Modèles et voix Pocket TTS | `~/.cache/huggingface/` (téléchargés à la première lecture) |
| Service Chatterbox (GPU) | quadlet `~/.config/containers/systemd/dev-chatterbox.container`, image `localhost/dev-chatterbox`, poids dans le volume `dev-chatterbox-cache`, port `127.0.0.1:8004` |
| Config (langue, vocabulaire, micro) | `.data/config.json` |
| whisper.cpp | `~/dev/Gear/tools/whisper.cpp` — `build-vulkan/` (GPU, utilisé), `build/` (CPU, secours) |
| Lanceurs | `~/dev/Gear/tools/whisper.sh` (projet), `~/dev/Gear/tools/whisper-appimage.sh` (AppImage) |
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
- **`whisper-cli` est un script** qui appelle le binaire de `build-vulkan/`
  (un lien symbolique marcherait aussi : l'appli les suit, pour l'exécutable
  comme pour le modèle). Retour au CPU : remplacer `build-vulkan` par `build`
  dedans.
- **Collage manuel** : l'appli sait envoyer Ctrl+V seule (`xdotool`, `wtype`,
  `ydotool`). Dans la box, aucun n'est installé : le texte reste dans le
  presse-papiers. Sur l'hôte (AppImage), `xdotool` est là et colle, mais KDE
  Wayland demande l'autorisation de contrôler la saisie à chaque fois (ou une
  fois pour toutes) ; pour ne rien simuler, clic droit → décocher *Coller
  automatiquement là où est le curseur*. `ydotool` éviterait la demande, mais
  il faut son démon sur l'hôte. Écarté pour l'instant. Pour y revenir : `ydotoold` est fourni par
  Bazzite, `/dev/uinput` est déjà accessible sans root → service utilisateur
  sur l'hôte avec `--socket-path=%t/.ydotool_socket`, paquet `ydotool` dans la
  box, et `YDOTOOL_SOCKET` exporté par le lanceur.
- **Pocket TTS par `uv tool`**, pas par `dnf` : il vit dans le home et
  survit à la recréation de la box. Désinstaller : `uv tool uninstall
  pocket-tts`. Installé avec `--index https://download.pytorch.org/whl/cpu`
  pour la version de PyTorch sans CUDA.
- **Processeur, pas GPU** : quantifié en int8, le modèle français génère ~5 fois
  plus vite que la lecture, l'anglais davantage ; l'audio part au fil de la
  génération. Coût : ~1,5 Go de mémoire vive par langue chargée, rendus après
  10 min sans lecture.
- **Choix du moteur** : essayés à l'écoute, Piper (voix plus mécaniques ; les
  mots anglais passaient mal, même avec une voix par langue ou un dictionnaire
  de prononciation) et Chatterbox (GPU, conteneur). Pocket TTS l'emporte sur
  Piper, sans GPU ; Chatterbox, plus naturel encore, reste au choix dans le
  menu (service `dev-chatterbox`, ~4,6 Go de VRAM pendant la lecture, ~330 Mo
  au repos).
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
git clone https://github.com/GearProductions/whisper.git whisper-dictation
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

# 4. Lecture à voix haute : Pocket TTS (modèles téléchargés à la première lecture)
uv tool install pocket-tts --index https://download.pytorch.org/whl/cpu
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
alias whisper-dev="$HOME/dev/Gear/tools/whisper.sh"
```
