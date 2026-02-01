# pir — Paste Image Remote

Paste clipboard images to a remote server for use with Claude Code over SSH.

## The Problem

When using Claude Code over SSH, you can't paste images directly with Ctrl+V because the clipboard isn't shared between your local machine and the remote server.

## The Solution

`pir` runs on your **local machine** and:

1. Grabs the image from your clipboard
2. SCPs it to the remote server
3. Copies `@/path/to/image.png` to your clipboard
4. You paste into Claude Code - it reads the file
5. The file is automatically deleted after a few minutes

## Installation

```bash
./pir install
```

That's it. The installer:
- Detects your OS (macOS or Linux)
- Installs the clipboard dependency (`pngpaste` on macOS, `xclip` on Linux)
- Copies the script to your PATH (`/usr/local/bin`, `~/.local/bin`, or `~/bin`)
- Adds the install directory to your PATH if needed
- Creates the config directory

You can re-run `pir install` at any time -- it's idempotent.

## Quick Start

```bash
# 1. Install
./pir install

# 2. Add your remote host
pir add-host

# 3. Copy an image to your clipboard, then:
pir

# 4. Paste into Claude Code with Ctrl+V / Cmd+V
```

## Managing Hosts

`pir` supports multiple remote hosts. If only one host is configured, it's used automatically. If multiple are configured, you'll be prompted to pick one.

### Add a host

Interactive:
```bash
pir add-host
```

Or inline:
```bash
pir add-host work user@work-server.com /home/user/images
pir add-host home user@home-server.com
```

The third argument (remote path) is optional and defaults to `/tmp/claude-images`.

### Update a host

Run `add-host` again with the same name -- it will ask to update:
```bash
pir add-host work user@new-server.com /new/path
```

### Remove a host

Interactive (shows a numbered list):
```bash
pir remove-host
```

Or by name:
```bash
pir remove-host work
```

### List hosts

```bash
pir list-hosts
```

## Usage

### Single host configured

```bash
# Just run it -- the sole host is selected automatically
pir
```

### Multiple hosts configured

```bash
# You'll see a numbered menu:
#   Select a host:
#     1. work  (user@work-server.com)
#     2. home  (user@home-server.com)
#   Host number [1-2]:
pir
```

### Override host via flags

```bash
pir -h user@server.com
pir -h user@server.com -p /custom/path
```

## Commands

| Command | Description |
|---------|-------------|
| *(default)* | Paste clipboard image to remote host |
| `install` | Install dependencies and add script to PATH |
| `add-host` | Add or update a remote host |
| `remove-host` | Remove a remote host |
| `list-hosts` | List configured hosts |

## Paste Options

| Option | Description |
|--------|-------------|
| `-h, --host HOST` | SSH host (overrides configured hosts) |
| `-p, --path PATH` | Remote directory (default: /tmp/claude-images) |
| `-c, --cleanup MIN` | Cleanup delay in minutes (default: 5) |
| `-n, --name NAME` | Custom filename |
| `--no-cleanup` | Don't schedule cleanup |
| `--help` | Show help |

## Configuration

Host data is stored in `~/.config/pir/hosts` (tab-separated). You can edit it directly if you prefer, but the `add-host` / `remove-host` commands are easier.

Global settings live in `~/.config/pir/settings`:

```bash
CLEANUP_MINUTES=5
```

## Keyboard Shortcut (Recommended)

For quick access, bind `pir` to a keyboard shortcut.

### macOS (with Automator)

1. Open Automator
2. Create a new "Quick Action"
3. Add "Run Shell Script" action
4. Enter: `/usr/local/bin/pir`
5. Save as "Paste Image Remote"
6. Go to System Preferences > Keyboard > Shortcuts > Services
7. Assign a shortcut (e.g., Cmd+Shift+V)

### Linux (GNOME)

```bash
# Settings > Keyboard > Custom Shortcuts
# Name: Paste Image Remote
# Command: /home/user/.local/bin/pir
# Shortcut: Super+Shift+V
```

### Linux (i3/sway)

```
bindsym $mod+Shift+v exec pir
```

## How It Works

```
┌─────────────────────┐     ┌─────────────────────┐
│   Local Machine     │     │   Remote Server     │
│                     │     │                     │
│  1. Grab clipboard  │     │                     │
│     image           │     │                     │
│         │           │     │                     │
│  2. Save to temp    │     │                     │
│         │           │     │                     │
│  3. SCP ─────────────────→│  4. Save to         │
│         │           │     │     /tmp/image.png  │
│  4. Copy "@path"    │     │                     │
│     to clipboard    │     │  5. Auto-delete     │
│         │           │     │     after N mins    │
│  5. Paste into      │     │                     │
│     Claude Code ─────────→│  6. Claude reads    │
│                     │     │     the image       │
└─────────────────────┘     └─────────────────────┘
```

## Troubleshooting

### "pngpaste not found" / "xclip not found"
Run `pir install` to automatically install dependencies.

### "No image in clipboard"
Make sure you've copied an image, not a file. Use Cmd+Shift+4 (macOS) or a screenshot tool.

### "No hosts configured"
Run `pir add-host` to configure a remote host.

### "Failed to upload file"
Check your SSH connection and permissions on the remote path.

### Images aren't showing in Claude Code
Make sure you're pasting the full `@/path/to/image.png` text, not trying to paste the image itself.

## Credits

Inspired by solutions from:
- [pngpaste](https://github.com/jcsalterego/pngpaste) - Clipboard to PNG on macOS
- [SSH clipboard forwarding techniques](https://gist.github.com/dergachev/8259104)
