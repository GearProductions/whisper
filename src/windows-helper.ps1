# Whisper — assistant Windows : clavier simulé et micro Discord.
# Processus PERMANENT piloté par windows.js : démarrer PowerShell et compiler
# les types ci-dessous coûte ~1 s, qu'on ne veut pas payer à chaque action.
# Une commande par ligne sur stdin, une ligne de réponse sur stdout :
#   paste            Ctrl+V dans l'application au premier plan   -> ok
#   copy             Ctrl+C (lire la sélection)                  -> ok
#   discord-mute     coupe les flux de capture de Discord        -> nombre coupé et confirmé
#   discord-restore  rétablit ceux qu'on a coupés                -> ok
# Toute erreur répond « err » : l'appli n'attend jamais en vain.

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class WhisperKeys {
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  const uint KEYUP = 2;
  const byte CTRL = 0x11;
  static void CtrlPlus(byte key) {
    keybd_event(CTRL, 0, 0, UIntPtr.Zero);
    keybd_event(key, 0, 0, UIntPtr.Zero);
    keybd_event(key, 0, KEYUP, UIntPtr.Zero);
    keybd_event(CTRL, 0, KEYUP, UIntPtr.Zero);
  }
  public static void Paste() { CtrlPlus(0x56); }  // V
  public static void Copy() { CtrlPlus(0x43); }   // C
}

// ---- Core Audio : sessions de capture par application ----------------------
// Seules les méthodes appelées sont déclarées, dans l'ordre de leur table
// virtuelle (celles qui précèdent sont gardées comme bouche-trous).

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumeratorCom { }

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
}

[Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection {
  [PreserveSig] int GetCount(out uint count);
  [PreserveSig] int Item(uint index, out IMMDevice device);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams,
                             [MarshalAs(UnmanagedType.IUnknown)] out object iface);
}

[Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {
  [PreserveSig] int GetAudioSessionControl(IntPtr sessionGuid, int flags, out IntPtr control);  // IAudioSessionManager
  [PreserveSig] int GetSimpleAudioVolume(IntPtr sessionGuid, int flags, out IntPtr volume);     // IAudioSessionManager
  [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessions);
}

[Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {
  [PreserveSig] int GetCount(out int count);
  [PreserveSig] int GetSession(int index, [MarshalAs(UnmanagedType.IUnknown)] out object session);
}

[Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl2 {
  // IAudioSessionControl : 9 méthodes
  [PreserveSig] int GetState(out int state);
  [PreserveSig] int GetDisplayName(out IntPtr name);
  [PreserveSig] int SetDisplayName(IntPtr name, IntPtr context);
  [PreserveSig] int GetIconPath(out IntPtr path);
  [PreserveSig] int SetIconPath(IntPtr path, IntPtr context);
  [PreserveSig] int GetGroupingParam(out Guid grouping);
  [PreserveSig] int SetGroupingParam(IntPtr grouping, IntPtr context);
  [PreserveSig] int RegisterAudioSessionNotification(IntPtr client);
  [PreserveSig] int UnregisterAudioSessionNotification(IntPtr client);
  // IAudioSessionControl2
  [PreserveSig] int GetSessionIdentifier(out IntPtr id);
  [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr id);
  [PreserveSig] int GetProcessId(out uint pid);
}

[Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface ISimpleAudioVolume {
  [PreserveSig] int SetMasterVolume(float level, IntPtr context);
  [PreserveSig] int GetMasterVolume(out float level);
  [PreserveSig] int SetMute(int mute, IntPtr context);   // BOOL Win32 : 4 octets
  [PreserveSig] int GetMute(out int mute);
}

// Comme sous Linux : on ne coupe que les flux de capture de Discord qui ne
// l'étaient pas, et on ne rétablit que ceux-là.
public static class WhisperDiscord {
  const int CAPTURE = 1, ACTIVE = 1, CLSCTX_ALL = 23;
  static readonly List<object> muted = new List<object>();

  static bool IsDiscord(uint pid) {
    try { return Process.GetProcessById((int)pid).ProcessName.IndexOf("discord", StringComparison.OrdinalIgnoreCase) >= 0; }
    catch { return false; }  // processus terminé entre-temps
  }

  static IEnumerable<ISimpleAudioVolume> DiscordCaptureSessions() {
    var result = new List<ISimpleAudioVolume>();
    var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
    IMMDeviceCollection devices;
    if (enumerator.EnumAudioEndpoints(CAPTURE, ACTIVE, out devices) != 0) return result;
    uint count;
    devices.GetCount(out count);
    var iid = typeof(IAudioSessionManager2).GUID;
    for (uint i = 0; i < count; i++) {
      IMMDevice device;
      object managerObj;
      if (devices.Item(i, out device) != 0) continue;
      if (device.Activate(ref iid, CLSCTX_ALL, IntPtr.Zero, out managerObj) != 0) continue;
      IAudioSessionEnumerator sessions;
      if (((IAudioSessionManager2)managerObj).GetSessionEnumerator(out sessions) != 0) continue;
      int n;
      sessions.GetCount(out n);
      for (int j = 0; j < n; j++) {
        object session;
        uint pid;
        if (sessions.GetSession(j, out session) != 0) continue;
        if (((IAudioSessionControl2)session).GetProcessId(out pid) != 0 || !IsDiscord(pid)) continue;
        result.Add((ISimpleAudioVolume)session);
      }
    }
    return result;
  }

  // Nombre de flux dont la coupure est confirmée (relue après coup).
  public static int Mute() {
    int confirmed = 0;
    foreach (var volume in DiscordCaptureSessions()) {
      int already;
      if (volume.GetMute(out already) != 0 || already != 0) continue;  // déjà muet : on n'y touche pas
      if (volume.SetMute(1, IntPtr.Zero) != 0) continue;
      muted.Add(volume);
      int now;
      if (volume.GetMute(out now) == 0 && now != 0) confirmed++;
    }
    return confirmed;
  }

  public static void Restore() {
    foreach (ISimpleAudioVolume volume in muted) {
      try { volume.SetMute(0, IntPtr.Zero); } catch { }  // appel quitté entre-temps : sans importance
    }
    muted.Clear();
  }
}
'@

function Reply($text) {
  [Console]::Out.WriteLine($text)
  [Console]::Out.Flush()
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.Trim() -eq '') { continue }
  try {
    switch ($line.Trim()) {
      'paste'           { [WhisperKeys]::Paste(); Reply 'ok' }
      'copy'            { [WhisperKeys]::Copy(); Reply 'ok' }
      'discord-mute'    { Reply ([WhisperDiscord]::Mute()) }
      'discord-restore' { [WhisperDiscord]::Restore(); Reply 'ok' }
      default           { Reply 'err' }
    }
  } catch {
    Reply 'err'
  }
}
