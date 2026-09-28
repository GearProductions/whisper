# Whisper — Ctrl+V simulé dans l'application au premier plan (Windows).
# Processus PERMANENT piloté par paste.js : démarrer PowerShell et charger
# user32 coûte ~0,5 s, qu'on ne veut pas payer à chaque phrase.
# Une commande par ligne sur stdin (« paste »), une réponse « ok » sur stdout.

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WhisperPaste {
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  const uint KEYUP = 2;
  public static void Paste() {
    keybd_event(0x11, 0, 0, UIntPtr.Zero);      // Ctrl
    keybd_event(0x56, 0, 0, UIntPtr.Zero);      // V
    keybd_event(0x56, 0, KEYUP, UIntPtr.Zero);
    keybd_event(0x11, 0, KEYUP, UIntPtr.Zero);
  }
}
'@

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.Trim() -eq 'paste') {
    try { [WhisperPaste]::Paste() } catch { }
    [Console]::Out.WriteLine('ok')
    [Console]::Out.Flush()
  }
}
