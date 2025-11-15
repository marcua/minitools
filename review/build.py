#!/usr/bin/env python3
"""
Build script for GitHub PR Review Comments Extractor bookmarklet

This script:
1. Reads the human-readable source code from bookmarklet.src.js
2. Minifies it by removing comments and unnecessary whitespace
3. Encodes it as a bookmarklet URL
4. Generates an HTML file with the bookmarklet link
"""

import re
import urllib.parse


def minify_js(js_code):
    """
    Simple JavaScript minification
    - Removes multi-line comments (/* ... */)
    - Removes single-line comments (// ...)
    - Removes leading/trailing whitespace from lines
    - Collapses multiple spaces into one
    - Removes blank lines

    Note: This is a conservative minifier that preserves JavaScript syntax.
    It does NOT aggressively remove whitespace around operators to avoid
    breaking arrow functions (=>) and other constructs.
    """
    # Remove multi-line comments
    js_code = re.sub(r'/\*.*?\*/', '', js_code, flags=re.DOTALL)

    # Remove single-line comments (but not URLs with //)
    js_code = re.sub(r'(?<!:)//.*?$', '', js_code, flags=re.MULTILINE)

    # Split into lines and process
    lines = js_code.split('\n')
    processed_lines = []

    for line in lines:
        # Strip leading/trailing whitespace
        line = line.strip()

        # Skip empty lines
        if not line:
            continue

        processed_lines.append(line)

    # Join lines with single space between each line
    minified = ' '.join(processed_lines)

    # Only collapse multiple consecutive spaces (safe operation)
    minified = re.sub(r'  +', ' ', minified)

    return minified.strip()


def create_bookmarklet_url(js_code):
    """
    Create a bookmarklet URL from JavaScript code
    """
    return 'javascript:' + urllib.parse.quote(js_code)


def generate_html(bookmarklet_url, minified_js):
    """
    Generate an HTML page with the bookmarklet
    """
    # Calculate sizes
    original_size = len(open('bookmarklet.src.js').read())
    minified_size = len(minified_js)
    reduction = ((original_size - minified_size) / original_size) * 100

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub PR Review Comments Extractor - Bookmarklet</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 0 20px;
            line-height: 1.6;
            color: #24292e;
        }}

        h1 {{
            border-bottom: 2px solid #e1e4e8;
            padding-bottom: 10px;
        }}

        .bookmarklet {{
            display: inline-block;
            padding: 12px 24px;
            background: #2ea44f;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: background 0.2s;
        }}

        .bookmarklet:hover {{
            background: #2c974b;
        }}

        .instructions {{
            background: #f6f8fa;
            border: 1px solid #e1e4e8;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
        }}

        .instructions ol {{
            margin: 10px 0;
            padding-left: 20px;
        }}

        .instructions li {{
            margin: 8px 0;
        }}

        code {{
            background: #f6f8fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 14px;
        }}

        .stats {{
            color: #586069;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e1e4e8;
        }}

        .warning {{
            background: #fff3cd;
            border: 1px solid #ffecb5;
            border-radius: 6px;
            padding: 12px;
            margin: 20px 0;
            color: #856404;
        }}
    </style>
</head>
<body>
    <h1>GitHub PR Review Comments Extractor</h1>

    <p>
        This bookmarklet extracts review comments from GitHub PRs and copies them to your clipboard
        in Markdown format, perfect for pasting into Claude Code.
    </p>

    <div class="instructions">
        <h2>Installation</h2>
        <ol>
            <li>Drag this link to your bookmarks bar:
                <a href="{bookmarklet_url}" class="bookmarklet">📋 Extract PR Comments</a>
            </li>
            <li>If you can't drag it, right-click and select "Add to Bookmarks" or "Bookmark This Link"</li>
        </ol>
    </div>

    <div class="instructions">
        <h2>Usage</h2>
        <ol>
            <li>Navigate to a GitHub Pull Request</li>
            <li>Click on the <code>Files changed</code> tab</li>
            <li>Click the bookmarklet in your bookmarks bar</li>
            <li>The comments will be copied to your clipboard in Markdown format</li>
            <li>Paste them into Claude Code</li>
        </ol>
    </div>

    <div class="warning">
        <strong>Note:</strong> The bookmarklet only extracts <strong>unresolved</strong> review comments by default.
        If you want to include resolved comments, you'll need to edit the source code.
    </div>

    <h2>Output Format</h2>
    <p>The bookmarklet generates markdown in the following format:</p>
    <pre><code># PR Review Comments

## filename.py

### Line 42

Comment text here

### Lines 50-55

Multi-line comment text here
</code></pre>

    <div class="stats">
        <p>Build stats:</p>
        <ul>
            <li>Original size: {original_size:,} bytes</li>
            <li>Minified size: {minified_size:,} bytes</li>
            <li>Reduction: {reduction:.1f}%</li>
        </ul>
        <p>
            Source code: <a href="bookmarklet.src.js">bookmarklet.src.js</a> |
            Build script: <a href="build.py">build.py</a>
        </p>
    </div>
</body>
</html>
'''
    return html


def main():
    print('Building GitHub PR Review Comments Extractor bookmarklet...')

    # Read source
    print('Reading source from bookmarklet.src.js...')
    with open('bookmarklet.src.js', 'r') as f:
        source_js = f.read()

    # Minify
    print('Minifying JavaScript...')
    minified_js = minify_js(source_js)

    # Create bookmarklet URL
    print('Creating bookmarklet URL...')
    bookmarklet_url = create_bookmarklet_url(minified_js)

    # Generate HTML
    print('Generating bookmarklet.html...')
    html = generate_html(bookmarklet_url, minified_js)

    with open('bookmarklet.html', 'w') as f:
        f.write(html)

    print('')
    print('✓ Build complete!')
    print(f'  Original size: {len(source_js):,} bytes')
    print(f'  Minified size: {len(minified_js):,} bytes')
    print(f'  Reduction: {((len(source_js) - len(minified_js)) / len(source_js)) * 100:.1f}%')
    print('')
    print('Open bookmarklet.html in your browser to install the bookmarklet.')


if __name__ == '__main__':
    main()
