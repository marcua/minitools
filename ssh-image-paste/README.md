# SSH Image Paste for Claude Code

Paste clipboard images to a remote server for use with Claude Code over SSH.

## The Problem

When using Claude Code over SSH, you can't paste images directly with Ctrl+V because the clipboard isn't shared between your local machine and the remote server.

## The Solution

This tool runs on your **local machine** and:

1. Grabs the image from your clipboard
2. SCPs it to the remote server
3. Copies `@/path/to/image.png` to your clipboard
4. You paste into Claude Code - it reads the file
5. The file is automatically deleted after a few minutes

## Installation

### macOS

```bash
# Install pngpaste (required for clipboard image access)
brew install pngpaste

# Copy the script to your PATH
cp paste-image-remote /usr/local/bin/
# or
cp paste-image-remote ~/bin/
```

### Linux

```bash
# Install xclip (required for clipboard image access)
sudo apt install xclip  # Debian/Ubuntu
sudo pacman -S xclip    # Arch
sudo dnf install xclip  # Fedora

# Copy the script to your PATH
cp paste-image-remote ~/.local/bin/
```

## Configuration

### Option 1: Config File

Create `~/.config/paste-image-remote/config`:

```bash
REMOTE_HOST="user@myserver.com"
REMOTE_PATH="/home/user/claude-images"
CLEANUP_MINUTES=10
```

### Option 2: Environment Variables

```bash
export SSH_IMAGE_HOST="user@myserver.com"
export SSH_IMAGE_PATH="/home/user/claude-images"
export SSH_IMAGE_CLEANUP=10
```

Add to your `~/.bashrc` or `~/.zshrc` for persistence.

### Option 3: Command Line Arguments

```bash
paste-image-remote -h user@server.com -p /tmp/images -c 5
```

## Usage

1. **Copy an image** to your clipboard (screenshot, copy from browser, etc.)

2. **Run the tool** on your local machine:
   ```bash
   paste-image-remote
   ```

3. **Paste** into Claude Code with Ctrl+V (or Cmd+V)
   - The tool copied `@/path/to/image.png` to your clipboard
   - Claude Code will read the image file

4. **Done!** The file auto-deletes after the cleanup delay (default: 5 minutes)

## Options

| Option | Description |
|--------|-------------|
| `-h, --host HOST` | SSH host (user@server.com) |
| `-p, --path PATH` | Remote directory (default: /tmp/claude-images) |
| `-c, --cleanup MIN` | Cleanup delay in minutes (default: 5) |
| `-n, --name NAME` | Custom filename |
| `--no-cleanup` | Don't schedule cleanup |
| `--help` | Show help |

## Keyboard Shortcut (Recommended)

For quick access, bind the tool to a keyboard shortcut.

### macOS (with Automator)

1. Open Automator
2. Create a new "Quick Action"
3. Add "Run Shell Script" action
4. Enter: `/usr/local/bin/paste-image-remote`
5. Save as "Paste Image Remote"
6. Go to System Preferences > Keyboard > Shortcuts > Services
7. Assign a shortcut (e.g., Cmd+Shift+V)

### Linux (GNOME)

```bash
# Settings > Keyboard > Custom Shortcuts
# Name: Paste Image Remote
# Command: /home/user/.local/bin/paste-image-remote
# Shortcut: Super+Shift+V
```

### Linux (i3/sway)

```
bindsym $mod+Shift+v exec paste-image-remote
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

### "pngpaste not found"
Install it: `brew install pngpaste`

### "No image in clipboard"
Make sure you've copied an image, not a file. Use Cmd+Shift+4 (macOS) or a screenshot tool.

### "Failed to upload file"
Check your SSH connection and permissions on the remote path.

### Images aren't showing in Claude Code
Make sure you're pasting the full `@/path/to/image.png` text, not trying to paste the image itself.

## Credits

Inspired by solutions from:
- [pngpaste](https://github.com/jcsalterego/pngpaste) - Clipboard to PNG on macOS
- [SSH clipboard forwarding techniques](https://gist.github.com/dergachev/8259104)
