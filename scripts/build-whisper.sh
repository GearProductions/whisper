#!/usr/bin/env bash
# Compile whisper-cli pour le paquet autonome et le copie dans resources/bin/.
#
# Moteurs de calcul chargés au démarrage (GGML_BACKEND_DL) : Vulkan si la
# machine en dispose (toute carte NVIDIA, AMD, Intel), sinon le processeur,
# dans la variante la plus rapide qu'il supporte (GGML_CPU_ALL_VARIANTS). Un
# seul binaire pour tous les postes.
#
# Usage : scripts/build-whisper.sh [dossier de travail]   (Linux ou Windows/bash)
# Prérequis : git, cmake, un compilateur C++, le SDK Vulkan (glslc).
set -euo pipefail

WHISPER_TAG=v1.9.4
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${1:-$ROOT/build/whisper.cpp}"
OUT="$ROOT/resources/bin"

if [ ! -d "$WORK/.git" ]; then
  git clone --depth 1 --branch "$WHISPER_TAG" https://github.com/ggml-org/whisper.cpp.git "$WORK"
fi

cmake -S "$WORK" -B "$WORK/build" -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=ON -DGGML_BACKEND_DL=ON -DGGML_CPU_ALL_VARIANTS=ON -DGGML_NATIVE=OFF \
  -DGGML_VULKAN=ON -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF \
  -DCMAKE_BUILD_RPATH='$ORIGIN' -DCMAKE_INSTALL_RPATH='$ORIGIN'
cmake --build "$WORK/build" --config Release -j 8 --target whisper-cli

# Linux : build/bin/ ; Windows (MSVC) : build/bin/Release/.
BIN="$WORK/build/bin"
[ -d "$BIN/Release" ] && BIN="$BIN/Release"
mkdir -p "$OUT"
find "$BIN" -maxdepth 1 \( -name 'whisper-cli' -o -name 'whisper-cli.exe' -o -name '*.so*' -o -name '*.dll' \) \
  -exec cp -a {} "$OUT/" \;
# Bibliothèques rangées hors de bin/ selon la plateforme (libwhisper, libggml*).
find "$WORK/build" \( -name 'libwhisper.so*' -o -name 'libggml*.so*' \) -not -path "$OUT/*" -exec cp -a {} "$OUT/" \;
ls -la "$OUT"
