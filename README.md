# git-syncr

Automatically keep all your local git repos in sync with their remotes. Designed for developers who work across many repositories and want passive, reliable background syncing.

Works on **macOS** and **Linux**. Handles laptop sleep/wake gracefully — no syncs are ever missed.

## Features

- Scans a directory for all git repos and pulls remote changes
- Interactive CLI with setup wizard and directory browser
- Background service that syncs on a configurable schedule (default: every 24 hours)
- Safe by design: uses `git pull --ff-only`, skips dirty working trees
- Desktop notifications with sync summary
- Detailed logging with per-repo status tracking

## Install

```bash
npm install -g git-syncr
```

Requires [Node.js](https://nodejs.org/) 18+ and [git](https://git-scm.com/).

## Quick Start

```bash
git-syncr
```

On first run, the interactive setup wizard will guide you through:

1. **Select your sync directory** — navigate with arrow keys to pick the folder containing your repos
2. **Set sync interval** — how often to check for remote changes (default: 24h)
3. **Enable notifications** — desktop alerts after each sync run

After setup, the background service is installed automatically and the main menu appears.

## Usage

### Interactive Mode

```bash
git-syncr
```

Opens the main menu with options to:

- **Sync now** — pull remote changes for all repos immediately
- **Sync (dry run)** — check what would be synced without pulling
- **Setup** — change your configuration
- **View last log** — see the most recent sync results
- **Quit** — exit with the option to keep or stop the background service

### Non-Interactive Mode

For scripting or background service use:

```bash
# Sync with terminal output
git-syncr --verbose

# Check for changes without pulling
git-syncr --dry-run --verbose

# Both flags
git-syncr --verbose --dry-run
```

## How It Works

### Sync Logic

For each git repo found in your sync directory:

1. **Check working tree** — if there are uncommitted changes, the repo is skipped (never risks your work)
2. **Check branch** — skips repos in detached HEAD state or without a tracking branch
3. **Fetch** — pulls the latest refs from the tracking remote
4. **Compare** — checks if remote has new commits
5. **Pull** — uses `--ff-only` to apply changes (fails safely if history has diverged)

### Background Service

- **macOS**: Uses `launchd` with `StartInterval`. If your laptop is asleep when a sync is due, it runs immediately on wake.
- **Linux**: Uses `systemd` user timers with `Persistent=true`. Catches up on missed runs after resume.

### Status Codes

Each repo gets one of these statuses per sync run:

| Status | Meaning |
|---|---|
| `[SYNCED]` | New commits pulled successfully |
| `[UNCHANGED]` | Already up to date |
| `[SKIPPED]` | Dirty working tree, detached HEAD, or no tracking branch |
| `[ERROR]` | Fetch failed, ff-only failed, or other git error |

## Configuration

Config is stored at `~/.config/git-syncr/config.json`:

```json
{
  "syncDir": "/Users/you/Development",
  "intervalSeconds": 86400,
  "notificationsEnabled": true
}
```

You can edit this file directly or use `git-syncr` to change settings interactively.

### Interval Examples

| Value | Seconds |
|---|---|
| 1h | 3600 |
| 6h | 21600 |
| 12h | 43200 |
| 24h | 86400 |
| 7d | 604800 |

## Logs

Logs are written to:

- **macOS**: `~/Library/Logs/git-syncr/git-syncr.log`
- **Linux**: `~/.local/share/git-syncr/logs/git-syncr.log`

Each run produces a block like:

```
========================================
git-syncr run: 2026-04-04T09:15:32.000Z
========================================
[UNCHANGED] my-app (main)
[SYNCED]    api-server (main) abc1234..def5678
[SKIPPED]   docs (develop) -- dirty working tree
[ERROR]     fork-repo (main) -- ff-only failed
----------------------------------------
Summary: 1 synced, 1 unchanged, 1 skipped, 1 errored (4 total)
========================================
```

## Troubleshooting

### "No network connectivity"

The sync checks connectivity to github.com before running. If you're offline, it skips gracefully and retries on the next scheduled run.

### Repos showing as [SKIPPED]

- **dirty working tree** — you have uncommitted changes. Commit or stash them.
- **detached HEAD** — check out a branch with `git checkout main`.
- **no tracking branch** — set one with `git branch -u origin/main`.

### Repos showing as [ERROR]

- **fetch failed** — usually an auth issue. Check your git credentials or SSH keys.
- **ff-only failed** — local and remote have diverged. Manually merge or rebase to resolve.

### Service not running

```bash
# macOS — check if loaded
launchctl list | grep git-syncr

# Linux — check timer status
systemctl --user status git-syncr.timer
```

Re-run `git-syncr` and select **Setup** to reinstall the service.

### git not found by background service

The service includes `/opt/homebrew/bin`, `/usr/local/bin`, and `/usr/bin` in PATH. If your git is installed elsewhere, you may need to adjust the service configuration.

## Uninstalling

Run `git-syncr`, select **Quit**, then choose **Quit & stop background sync** to remove the service.

To fully uninstall:

```bash
npm uninstall -g git-syncr
rm -rf ~/.config/git-syncr
```

Logs are preserved. Remove them manually if desired.

## License

MIT
