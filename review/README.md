# GitHub PR Review Comments Extractor

A bookmarklet that extracts review comments from GitHub Pull Requests and copies them to your clipboard in Markdown format, ready to paste into Claude Code.

## Features

- 🎨 **Modal UI** - Shows comments in a nice modal with a textarea you can edit
- 📋 Extracts all unresolved review comments from a GitHub PR
- 📝 Formats comments in Markdown with file names and line numbers
- 🎯 Preserves comment structure (single-line and multi-line)
- ✂️ Copy button to copy all comments, or select/copy a subset
- 🔧 Easy to maintain with human-readable source code

## Installation

1. Open `bookmarklet.html` in your web browser
2. Drag the "📋 Extract PR Comments" link to your bookmarks bar
3. Alternatively, right-click the link and select "Add to Bookmarks"

## Usage

1. Navigate to a GitHub Pull Request
2. Click on the **Files changed** tab (side-by-side diff view)
3. Click the **📋 Extract PR Comments** bookmarklet in your bookmarks bar
4. A modal will appear with all comments in a textarea
5. Click **Copy to Clipboard** to copy everything, or select/highlight specific comments to copy just those
6. Paste the comments into Claude Code (or anywhere else)
7. Click **Close** or click outside the modal to dismiss it

## Output Format

The bookmarklet generates markdown in this format:

```markdown
# PR Review Comments

## product/site_builder/api_views/ai/views.py: line 42

This is a review comment on line 42

---

## product/site_builder/api_views/ai/views.py: lines 50-55

This is a review comment on lines 50-55. It might be
a multi-line comment or a suggestion to edit multiple lines.

---

## product/site_builder/autodesign/steps/site_agent/build_site.py: line 25

Another review comment here

---
```

## Customization

### Including Resolved Comments

By default, the bookmarklet only extracts **unresolved** comments. To include resolved comments:

1. Open `bookmarklet.src.js`
2. Find this section:

```javascript
// Skip resolved threads (optional - you can remove this if to include resolved comments)
if (thread.isResolved) {
  return;
}
```

3. Comment out or remove those lines
4. Run `python3 build.py` to rebuild the bookmarklet
5. Reload `bookmarklet.html` and reinstall the bookmarklet

### Changing the Output Format

The markdown format is defined in the `formatAsMarkdown()` function in `bookmarklet.src.js`. You can customize:

- The heading levels
- The line number format
- Whether to include author names
- Whether to include timestamps

After making changes, run `python3 build.py` to rebuild.

## Development

### Project Structure

```
review/
├── bookmarklet.src.js   # Human-readable source code
├── build.py             # Build script that minifies the bookmarklet
├── bookmarklet.html     # Generated HTML with bookmarklet link (do not edit directly)
└── README.md            # This file
```

### Making Changes

1. Edit `bookmarklet.src.js` (the human-readable source)
2. Run the build script:
   ```bash
   python3 build.py
   ```
3. Open `bookmarklet.html` in your browser
4. Reinstall the bookmarklet by dragging it to your bookmarks bar again

### How It Works

The bookmarklet:

1. Extracts the JSON payload from GitHub's React app (embedded in a `<script>` tag)
2. Parses the `threads` object containing all review comments
3. Matches thread IDs with file paths and line numbers from `diffSummaries`
4. Filters out resolved threads (optional)
5. Formats the comments as Markdown
6. Shows a modal with an editable textarea
7. Provides a copy button to copy all comments to clipboard

### Testing

To test changes:

1. Make your edits to `bookmarklet.src.js`
2. Run `python3 build.py`
3. Open a GitHub PR with review comments
4. Click the Files changed tab
5. Click the updated bookmarklet
6. Verify the output

## Troubleshooting

### "Could not find GitHub PR data"

Make sure you're on the **Files changed** tab of a Pull Request, not the Conversation tab.

### "No unresolved review comments found"

Either:
- There are no review comments on this PR, or
- All comments have been marked as resolved

If you want to extract resolved comments, see the "Including Resolved Comments" section above.

### Comments are missing

Some possible causes:
- Comments might be marked as resolved (see customization section)
- The GitHub PR page structure might have changed (file an issue if this happens)

### Clipboard copy fails

The bookmarklet requires a modern browser with Clipboard API support. Make sure you're using:
- Chrome/Edge 66+
- Firefox 63+
- Safari 13.1+

## Browser Compatibility

- ✅ Chrome/Edge (tested)
- ✅ Firefox (tested)
- ✅ Safari (should work)

## License

Free to use and modify for personal or commercial use.

## Contributing

Found a bug or want to add a feature?

1. Edit `bookmarklet.src.js`
2. Test your changes
3. Make sure it still works after running `build.py`
4. Share your improvements!
