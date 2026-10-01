# Chatterbox — lecture à voix haute sur GPU

Moteur optionnel de la lecture à voix haute : [Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox)
(Resemble AI, licence MIT), plus naturel que Pocket TTS, sur GPU NVIDIA. Il
tourne dans un conteneur podman, en service local sur `127.0.0.1:8004` ;
l'appli s'en sert quand clic droit → *Lecture à voix haute* → *Moteur* →
*Chatterbox (GPU)* est coché, et revient à Pocket TTS si le service ne répond
pas ou répond par une erreur.

- **Voix** : les mêmes que Pocket TTS (Estelle, Mary, Marius, Jane, Anna,
  Alba), clonées à partir des enregistrements Kyutai, copiés dans l'image.
- **GPU** : ~4,6 Go de VRAM pendant la lecture. Le modèle n'est chargé qu'à la
  demande (survol du bouton ▶, ~5 s) et libéré après 10 min sans lecture
  (`CHATTERBOX_IDLE_S`) ; au repos, le service garde ~330 Mo (contexte CUDA).
  Pas en même temps que ComfyUI ou gear-ai-worker.
- **Latence** : ~1 s avant le premier son ; la suite se génère plus vite
  qu'elle ne s'écoute.
- **Démarrage** : ~40 s après le lancement du service, une génération d'essai
  paie la mise en route (compilations au premier usage), puis libère la VRAM.
- Chaque audio porte un filigrane inaudible (Perth, Resemble AI).

## Installer (hôte)

```bash
cd ~/dev/Gear/tools/whisper-dictation/chatterbox
podman build -t localhost/dev-chatterbox .
cp dev-chatterbox.container ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user start dev-chatterbox
```

Le service démarre ensuite avec la session. La première lecture télécharge le
modèle (~3 Go) dans le volume `dev-chatterbox-cache`.

## Gérer

```bash
systemctl --user status dev-chatterbox
systemctl --user stop dev-chatterbox        # libère tout le GPU ; l'appli lit par Pocket TTS
journalctl --user -u dev-chatterbox -f      # journal
curl -s localhost:8004/health               # {"loaded": …}
```

Après une modification de `server.py` : reconstruire l'image, puis
`systemctl --user restart dev-chatterbox`.

## Désinstaller

```bash
systemctl --user stop dev-chatterbox
rm ~/.config/containers/systemd/dev-chatterbox.container
systemctl --user daemon-reload
podman rmi localhost/dev-chatterbox
podman volume rm dev-chatterbox-cache
```

## Choix techniques

- **Image de base** `pytorch/pytorch:2.8.0-cuda12.8-cudnn9-devel`, celle de
  gear-ai-worker (couches partagées). Chatterbox fige torch 2.6, qui ne connaît
  pas les RTX 50xx (`sm_120`) : le Containerfile force la version de l'image.
- **Protocole** : `POST /speak` rend des trames `[longueur u32 LE][PCM 16 bits
  mono]`, une par morceau de texte (le premier court, ~80 caractères, pour
  démarrer vite). Interrompre la requête arrête la génération.
- **Style par langue** (`STYLES` dans `server.py`, choisi à l'écoute) : le
  français sortait monotone, il est lu plus expressif (`exaggeration` 0,9,
  `cfg_weight` 0,3) ; l'anglais garde les valeurs par défaut (0,5 / 0,5). À 1,2,
  la voix devient emphatique et l'articulation s'en ressent.
- **Référence dans une autre langue que le texte** (Mary lisant du français…) :
  `cfg_weight=0`, comme le recommande Resemble, pour limiter l'accent.
- **Voix essayées et écartées** : les voix françaises du corpus CML-TTS, des
  dons de voix Kyutai et du corpus SIWIS (studio, CC-BY 4.0 : la meilleure
  alternative à Estelle). Les voix de personnes réelles ou de personnages
  (acteurs de doublage…) ne sont pas clonées.
- **Poids** dans un volume nommé : régénérables, pas besoin de les voir.
- **Pas de réseau après l'installation** : le segmenteur du chinois que charge
  le tokenizer (spacy-pkuseg) est téléchargé dans l'image. Sinon il l'était à
  chaque démarrage du conteneur, et au boot, le réseau du conteneur n'étant pas
  encore prêt, le modèle ne se chargeait plus (HTTP 500).
