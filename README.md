# Lisa Reminders (OpenClaw plugin)

Simple reminder scheduling with Telegram inline actions.

## Features

- Create reminders via chat: "remind me ..."
- List upcoming reminders: "list reminders"
- Snooze or mark done from inline buttons
- Durable JSON storage at `/home/bomoha/.openclaw/workspace/data/reminders.json`

## Install (local dev)

Option A: link the plugin into OpenClaw's extensions folder:

```bash
openclaw plugins install -l /home/bomoha/.openclaw/workspace/projects/lisa-reminders
```

Option B: add a load path in `openclaw.json`:

```json
{
  "plugins": {
    "load": {
      "paths": ["/home/bomoha/.openclaw/workspace/projects/lisa-reminders"]
    },
    "entries": {
      "lisa-reminders": { "enabled": true }
    }
  }
}
```

Restart the gateway after enabling.

## Usage

Create reminders:

- `remind me call mom in 10m`
- `remind me submit report today 14:30`
- `remind me check flights tomorrow 7`
- `remind me pay rent 5 Mar 14:00`
- `remind me prep notes Mon 9am`

List reminders:

- `list reminders`

When a reminder fires, it sends a Telegram DM to user `7295409952` with:

```

tone: plain text
message: "🔔 Reminder: <text>"
buttons: Snooze 5m | Done
```

Snooze pushes `dueAt + 5 minutes` and persists the change.

## Time parsing notes

Supported formats:

- Relative: `in 10m`, `in 2h`, `in 1h 30m`
- Today: `today 14:30`
- Tomorrow: `tomorrow 7` or `tomorrow 07:15`
- Weekday: `Mon 9am`
- Date: `5 Mar 14:00`

If the time is ambiguous, the plugin asks a clarifying question.

## Tests

```bash
node --test
```

## Configuration

Optional plugin config (in `plugins.entries.lisa-reminders.config`):

```json
{
  "storePath": "/home/bomoha/.openclaw/workspace/data/reminders.json",
  "allowedUserId": 7295409952,
  "snoozeMinutes": 5
}
```
