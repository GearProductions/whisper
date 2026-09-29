#!/usr/bin/env bash
# Télécharge uv (gestionnaire Python, un seul exécutable) dans resources/bin/ :
# l'appli s'en sert pour installer Pocket TTS au premier usage (cf. src/tts.js).
#
# Usage : scripts/fetch-uv.sh [linux|windows]   (par défaut : le système courant)
set -euo pipefail

UV_VERSION=0.12.20
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/resources/bin"
TARGET="${1:-$(case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) echo windows ;; *) echo linux ;; esac)}"
BASE="https://github.com/astral-sh/uv/releases/download/$UV_VERSION"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

case "$TARGET" in
  linux)
    curl -fsSL "$BASE/uv-x86_64-unknown-linux-gnu.tar.gz" -o "$TMP/uv.tar.gz"
    tar -xzf "$TMP/uv.tar.gz" -C "$TMP"
    cp "$TMP"/uv-x86_64-unknown-linux-gnu/uv "$OUT/uv"
    chmod +x "$OUT/uv"
    ;;
  windows)
    curl -fsSL "$BASE/uv-x86_64-pc-windows-msvc.zip" -o "$TMP/uv.zip"
    unzip -o -q "$TMP/uv.zip" -d "$TMP/uv"
    cp "$TMP/uv/uv.exe" "$OUT/uv.exe"
    ;;
  *) echo "cible inconnue : $TARGET" >&2; exit 1 ;;
esac
ls -la "$OUT"/uv*
