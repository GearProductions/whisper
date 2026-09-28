# Whisper — dictée flottante

Une icône ronde, toujours au premier plan. **Maintenez le clic** dessus, parlez,
relâchez : la voix est transcrite **en local** par [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
et le texte est collé là où se trouve le curseur, dans n'importe quelle application.
C'est la dictée de l'icône compacte de Cockpit, seule.

- **Maintenir** : dicter (bip aigu = parlez, bip grave = fin).
- **Glisser** : déplacer l'icône (la position est retenue).
- **Clic droit** : langue, micro, bip, affichage du texte, micro Discord (Linux), dossier whisper, configuration, quitter.

À la fin d'une dictée, une bulle montre le texte transcrit à côté de l'icône :
**un clic dessus le copie** dans le presse-papiers. Elle disparaît seule après
10 s (le survol suspend ce délai). Désactivable : clic droit → *Afficher le texte transcrit*.

L'icône ne prend jamais le focus : le texte arrive dans l'application active.
Le presse-papiers est restauré après le collage (sauf si le collage a échoué :
le texte y reste, pour un Ctrl+V manuel).

## Installation

```bash
npm install
npm start
```

### whisper.cpp

Placez `whisper-cli` (`whisper-cli.exe` sous Windows) et un modèle `ggml-*.bin`
dans le dossier whisper (clic droit → *Ouvrir le dossier whisper*) :

| OS      | Dossier                                    |
|---------|--------------------------------------------|
| Windows | `%APPDATA%\whisper-dictation\whisper\`     |
| Linux   | `~/.config/whisper-dictation/whisper/`     |

Le modèle se pose à la racine du dossier ; l'exécutable peut être jusqu'à deux
niveaux plus bas (`bin/Release/` d'une release Windows, `build/bin/` d'un build
Linux). Si ce dossier est incomplet, l'installation de **Cockpit**
(`…/cockpit/whisper/`) est utilisée.

Linux : compilez whisper.cpp (`cmake -B build && cmake --build build -j`) puis
copiez ou liez `build/bin/whisper-cli` et le modèle.

### Collage sous Linux

Il faut un outil pour simuler Ctrl+V :

- **X11** : `xdotool` (`sudo apt install xdotool`)
- **Wayland** : `wtype` (Sway, Hyprland…) ou `ydotool` (avec son démon `ydotoold`)

Sans outil, le texte reste dans le presse-papiers. Note : la plupart des
terminaux Linux collent avec Ctrl+Maj+V, pas Ctrl+V.

### Micro Discord (Linux)

Clic droit → *Autoriser la coupure du micro Discord* (désactivé par défaut) :
en appel Discord, le micro est coupé le temps de l'enregistrement, puis
rétabli. Un micro déjà coupé le reste.

C'est le flux de capture de Discord qui est coupé, dans PipeWire, pas le bouton
« muet » de Discord : son icône ne change pas. À la place, une bulle
*Micro Discord coupé* s'affiche le temps de l'enregistrement, une fois la
coupure confirmée par PipeWire.

Il faut `wpctl`, livré avec WirePlumber (installé d'office avec PipeWire).

## Configuration

`config.json`, à côté du dossier whisper (clic droit → *Modifier la configuration*) :

| Clé          | Rôle                                                              |
|--------------|-------------------------------------------------------------------|
| `lang`       | `fr`, `en`, `auto`…                                               |
| `vocabulary` | Mots propres à votre domaine, pour guider whisper (300 car. max) |
| `sound`      | Bips de début / fin                                               |
| `showText`   | Bulle du texte transcrit à la fin d'une dictée                    |
| `discordMute`| Linux : couper le micro Discord pendant l'enregistrement          |
| `size`       | Taille de l'icône en px (32–200, appliquée au redémarrage)        |

Relu à chaque dictée : pas besoin de relancer (sauf pour `size`).

## Paquet

```bash
npm run build:win
```

```bash
npm run build:linux
```
