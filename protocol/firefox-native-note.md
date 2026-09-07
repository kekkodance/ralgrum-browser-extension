# Firefox notes

Version 1 needs no native messaging host. Firefox navigates to ralgrum://
links from the background script the same way Chrome does, and the OS
protocol registration (see windows-register-protocol.ps1) opens ralgruM.

If a richer bridge is wanted later (play state, queue length, resolve check),
add a native messaging host named com.ralgrum.bridge with a small local
helper. Keep it optional: the extension must keep working with plain
protocol navigation when the host is absent.
