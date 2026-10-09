---
name: cleanup-temp-files
description: >-
  Use this skill whenever you have created temporary scripts (like .js, .py, .sh) to perform text replacement, data fetching, or debugging during a task. It reminds you to delete them to keep the workspace clean.
---

# Clean Up Temporary Files

Whenever you create scripts (like `fix_alerts.js`, `test.py`, etc.) inside the project's workspace to automate repetitive tasks or run one-off scripts, you must ensure that they are deleted once you are done using them.

## Steps

1. Identify any temporary scripts or data files you created during this conversation turn.
2. Use the `run_command` tool (e.g., `rm <filename>` or `Remove-Item <filename>`) to delete them.
3. Briefly inform the user that the workspace has been cleaned up.

**Exceptions**: Do not delete files inside the `<appDataDir>\brain\<conversation-id>/scratch/` directory or files the user explicitly asked you to generate.
