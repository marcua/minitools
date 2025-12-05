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
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Review — PR Comments Extractor</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Newsreader', serif;
            background: #fafaf9;
            color: #1c1917;
            line-height: 1.6;
            min-height: 100vh;
            padding: 80px 20px;
        }}

        .container {{
            max-width: 1100px;
            margin: 0 auto;
        }}

        .two-column {{
            display: flex;
            gap: 48px;
            align-items: flex-start;
        }}

        .two-column .left {{
            flex: 0 0 auto;
            min-width: 0;
        }}

        .two-column .right {{
            flex: 1;
            min-width: 0;
        }}

        .two-column video {{
            width: 100%;
            border-radius: 8px;
            border: 1px solid #e7e5e4;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }}

        @media (max-width: 800px) {{
            .two-column {{
                flex-direction: column;
            }}
        }}

        header {{
            margin-bottom: 60px;
            padding-bottom: 40px;
            border-bottom: 1px solid #e7e5e4;
        }}

        h1 {{
            font-size: 3rem;
            font-weight: 300;
            line-height: 1.2;
            margin-bottom: 16px;
            letter-spacing: -0.02em;
        }}

        .subtitle {{
            font-size: 1.1rem;
            color: #57534e;
            font-weight: 400;
        }}

        .bookmarklet-section {{
            background: white;
            border: 1px solid #e7e5e4;
            padding: 48px;
            margin: 48px 0;
            text-align: center;
        }}

        .bookmarklet {{
            display: inline-block;
            background: #1c1917;
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.95rem;
            font-weight: 500;
            letter-spacing: 0.02em;
            transition: all 0.2s ease;
            border: 2px solid #1c1917;
        }}

        .bookmarklet:hover {{
            background: white;
            color: #1c1917;
        }}

        .hint {{
            margin-top: 16px;
            color: #78716c;
            font-size: 0.9rem;
        }}

        .section {{
            margin: 48px 0;
        }}

        h2 {{
            font-size: 1.5rem;
            font-weight: 400;
            margin-bottom: 24px;
            letter-spacing: -0.01em;
        }}

        ol {{
            list-style: decimal;
            padding-left: 24px;
        }}

        ol li {{
            margin: 12px 0;
            color: #44403c;
            font-size: 1rem;
            padding-left: 8px;
        }}

        code {{
            background: #f5f5f4;
            border: 1px solid #e7e5e4;
            padding: 2px 8px;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.9em;
            color: #1c1917;
        }}

        pre {{
            background: white;
            border: 1px solid #e7e5e4;
            padding: 24px;
            overflow-x: auto;
            font-size: 0.9rem;
            line-height: 1.7;
            margin-top: 16px;
        }}

        pre code {{
            background: none;
            border: none;
            padding: 0;
        }}

        .note {{
            background: #fffbeb;
            border-left: 3px solid #fbbf24;
            padding: 20px;
            margin: 40px 0;
            font-size: 0.95rem;
        }}

        .note strong {{
            font-weight: 500;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Review</h1>
            <p class="subtitle">Extract GitHub PR review comments and transform them into markdown, ready to paste into your coding agent.</p>
        </header>

        <div class="bookmarklet-section">
            <a href="{bookmarklet_url}" class="bookmarklet">Review</a>
            <p class="hint">Drag to your bookmarks bar, or right-click to bookmark</p>
        </div>

        <div class="section">
            <div class="two-column">
                <div class="left">
                    <h2>How to use</h2>
                    <ol>
                        <li>Navigate to a GitHub Pull Request</li>
                        <li>Click the <code>Files changed</code> tab</li>
                        <li>Click the Review bookmarklet</li>
                        <li>Copy the comments from the modal</li>
                        <li>Paste into your coding agent</li>
                    </ol>
                </div>
                <div class="right">
                    <video autoplay loop muted playsinline controls>
                        <source src="review.mp4" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Output format</h2>
            <pre><code># PR Review Comments

## filename.py: line 42

Review comment text here

---

## another-file.js: lines 50-55

Multi-line comment spanning several lines of code

---</code></pre>
        </div>

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
    print('Generating index.html...')
    html = generate_html(bookmarklet_url, minified_js)

    with open('index.html', 'w') as f:
        f.write(html)

    print('')
    print('✓ Build complete!')
    print(f'  Original size: {len(source_js):,} bytes')
    print(f'  Minified size: {len(minified_js):,} bytes')
    print(f'  Reduction: {((len(source_js) - len(minified_js)) / len(source_js)) * 100:.1f}%')
    print('')
    print('Open index.html in your browser to install the bookmarklet.')


if __name__ == '__main__':
    main()
