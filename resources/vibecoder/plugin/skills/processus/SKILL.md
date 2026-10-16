---
name: processus
description: "Read the logs of the project's processes started by VibeCoder (dev server, front, services) and ask the app to stop or restart one. Use when you need the output of a running server or a restart after a change."
---

# The project's processes (VibeCoder's Processes tab)

The app (not you) starts the project's commands, listed in its Processes tab. Never start them yourself in the background: ask the app.

Your VibeCoder output folder is the additional working directory ending with `vibecoder-out/<agent id>` (call it `<out>`).

- **Logs**: `<out>/run/<name>.log`, one per command started at least once (stdout and stderr; the previous run in `<name>.log.old`, also when the log passed 5 MB). Read the end of it (`Read` with an offset, or `tail -n 100`). The names: the `.log` files there.
- **Stop**: create the empty file `<out>/run/<name>.stop`. **Restart** (or start a stopped one): `<out>/run/<name>.restart`. The app does it at its next survey (every 4 s while VibeCoder is shown) and deletes the file. Only the names of the project's commands count.
- To check: the log again a few seconds later (a restart starts a new log).

A command the user has not set up is not yours to add: tell the user (« Modify the commands » in the Processes tab).
