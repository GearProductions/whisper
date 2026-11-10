---
name: processus
description: "Read the logs of the project's processes started by VibeCoder (dev server, front, services) and ask the app to stop or restart one. Use when you need the output of a running server or a restart after a change."
---

# The project's processes (VibeCoder's Processes tab)

The app (not you) starts the project's commands, listed in its Processes tab. Never start them yourself in the background: ask the app.

Use the `vibecoder` command (it talks to the app):

- **List**: `node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" proc list`.
- **Logs**: `node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" proc logs <name>`: the end of its log (`<name>`: the name of one of the project's commands, as in its commands file: only the names of the project's commands count).
- **Stop**: `node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" proc stop <name>`.
- **Restart** (or start a stopped one): `node "${CLAUDE_SKILL_DIR}/../../bin/vibecoder.mjs" proc restart <name>` (`<name>`: the name of one of the project's commands, as in its commands file: only the names of the project's commands count).
- To check a restart: the logs again a few seconds later (a restart starts a new log).

A command the user has not set up is not yours to add: tell the user (« Modify the commands » in the Processes tab).
