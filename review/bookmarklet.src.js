/**
 * GitHub PR Review Comments Extractor
 *
 * This bookmarklet extracts review comments from a GitHub PR's Files Changed view
 * and displays them in a modal with copy functionality.
 *
 * Usage: Click the bookmarklet while viewing a GitHub PR's Files Changed tab
 */

(function() {
  'use strict';

  /**
   * Extract the JSON payload from GitHub's React app
   */
  function extractPayload() {
    const scriptTag = document.querySelector('script[data-target="react-app.embeddedData"]');
    if (!scriptTag) {
      throw new Error('Could not find GitHub PR data. Make sure you are on the Files Changed tab of a PR.');
    }

    try {
      return JSON.parse(scriptTag.textContent);
    } catch (e) {
      throw new Error('Failed to parse GitHub PR data: ' + e.message);
    }
  }

  /**
   * Parse line number from marker (e.g., "R25" -> 25, "L10" -> 10)
   */
  function parseLineFromMarker(marker) {
    const match = marker.match(/^[RL](\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }


  /**
   * Build a map of thread IDs to file paths, line numbers, and markers
   */
  function buildThreadLocationMap(diffSummaries) {
    const map = new Map();

    diffSummaries.forEach(file => {
      const filePath = file.path;
      const markersMap = file.markersMap || {};

      Object.entries(markersMap).forEach(([marker, data]) => {
        const lineContext = data.ctx || [];
        const contextStart = lineContext[0];
        const contextEnd = lineContext[1];

        // Try to extract actual line number from marker (e.g., R25 = line 25)
        const lineFromMarker = parseLineFromMarker(marker);

        (data.threads || []).forEach(thread => {
          map.set(thread.id.toString(), {
            filePath: filePath,
            marker: marker,
            line: lineFromMarker,
            contextStart: contextStart,
            contextEnd: contextEnd
          });
        });
      });

      // Also check for threads in diffLines (for multi-line comments)
      const diffLines = file.diffLines || [];
      diffLines.forEach(line => {
        if (line.threads && line.threads.length > 0) {
          const lineNumber = line.newLineNumber || line.oldLineNumber;
          line.threads.forEach(thread => {
            // Only add if not already in map
            if (!map.has(thread.id.toString())) {
              // Check if thread has line range information
              const startLine = thread.startLine || thread.line || lineNumber;
              const endLine = thread.endLine || startLine;

              console.log('Found thread in diffLines:', {
                id: thread.id,
                filePath: filePath,
                lineNumber: lineNumber,
                startLine: startLine,
                endLine: endLine,
                threadKeys: Object.keys(thread)
              });

              map.set(thread.id.toString(), {
                filePath: filePath,
                marker: `L${lineNumber}`,
                line: startLine,
                contextStart: startLine,
                contextEnd: endLine
              });
            }
          });
        }
      });
    });

    console.log('Built location map for', map.size, 'thread IDs');
    return map;
  }

  /**
   * Extract all review comments and organize by file
   */
  function extractComments(payload) {
    const threads = payload.threads || {};
    const diffSummaries = payload.diffSummaries || [];

    const locationMap = buildThreadLocationMap(diffSummaries);

    const commentsByFile = new Map();

    let totalThreads = 0;
    let resolvedThreads = 0;
    let missingLocationThreads = 0;
    let emptyThreads = 0;
    let extractedThreads = 0;

    Object.values(threads).forEach(thread => {
      totalThreads++;

      // Skip resolved threads (optional - you can remove this if to include resolved comments)
      if (thread.isResolved) {
        resolvedThreads++;
        return;
      }

      const location = locationMap.get(thread.id.toString());
      if (!location) {
        console.warn('Missing location for thread ID:', thread.id, {
          isResolved: thread.isResolved,
          isOutdated: thread.isOutdated,
          hasComments: (thread.commentsData?.comments || []).length,
          threadKeys: Object.keys(thread),
          startLine: thread.startLine,
          endLine: thread.endLine,
          line: thread.line,
          originalStartLine: thread.originalStartLine,
          originalEndLine: thread.originalEndLine
        });
        missingLocationThreads++;
        return;
      }

      const comments = thread.commentsData?.comments || [];
      if (comments.length === 0) {
        emptyThreads++;
        return;
      }

      const filePath = location.filePath;
      if (!commentsByFile.has(filePath)) {
        commentsByFile.set(filePath, []);
      }

      // Process each comment in the thread
      comments.forEach(comment => {
        commentsByFile.get(filePath).push({
          line: location.line,
          marker: location.marker,
          contextStart: location.contextStart,
          contextEnd: location.contextEnd,
          author: comment.author?.login || 'Unknown',
          body: comment.body || '',
          createdAt: comment.createdAt
        });
        extractedThreads++;
      });
    });

    console.log('Thread extraction summary:', {
      total: totalThreads,
      resolved: resolvedThreads,
      missingLocation: missingLocationThreads,
      empty: emptyThreads,
      extracted: extractedThreads
    });

    return commentsByFile;
  }

  /**
   * Transform GitHub suggestion blocks into readable format
   */
  function transformSuggestions(body) {
    // Match ```suggestion blocks (with optional whitespace/newlines)
    return body.replace(/```suggestion\s*\n?([\s\S]*?)```/g, (match, content) => {
      const trimmedContent = content.trim();
      if (trimmedContent === '') {
        return 'Delete this';
      } else {
        return `Rewrite to \`${trimmedContent}\``;
      }
    });
  }

  /**
   * Format comments as Markdown
   */
  function formatAsMarkdown(commentsByFile) {
    let markdown = '# PR Review Comments\n\n';

    // Sort files alphabetically
    const sortedFiles = Array.from(commentsByFile.keys()).sort();

    sortedFiles.forEach(filePath => {
      const comments = commentsByFile.get(filePath);

      // Sort comments by line number
      comments.sort((a, b) => (a.line || 0) - (b.line || 0));

      comments.forEach(comment => {
        // Build line reference
        let lineRef = '';
        if (comment.line) {
          lineRef = `line ${comment.line}`;
        } else if (comment.contextStart === comment.contextEnd) {
          lineRef = `line ${comment.contextStart}`;
        } else {
          lineRef = `lines ${comment.contextStart}-${comment.contextEnd}`;
        }

        // Format: ## file/path.py: line 25
        markdown += `## ${filePath}: ${lineRef}\n\n`;

        // Transform suggestion blocks and add the comment
        const transformedBody = transformSuggestions(comment.body);
        markdown += `${transformedBody}\n\n`;
        markdown += '---\n\n';
      });
    });

    return markdown;
  }

  /**
   * Create and show a modal with the extracted comments
   */
  function showModal(markdown) {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 1200px;
      width: 95%;
      height: 95vh;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      border-bottom: 1px solid #e1e4e8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #24292e;">PR Review Comments</h2>
      <button id="closeModal" style="
        background: transparent;
        border: none;
        font-size: 24px;
        color: #586069;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      ">&times;</button>
    `;

    // Create textarea
    const textareaContainer = document.createElement('div');
    textareaContainer.style.cssText = `
      padding: 20px;
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    const textarea = document.createElement('textarea');
    textarea.value = markdown;
    textarea.style.cssText = `
      width: 100%;
      height: 100%;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 12px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 13px;
      line-height: 1.5;
      resize: none;
      color: #24292e;
    `;
    textarea.readOnly = false;

    textareaContainer.appendChild(textarea);

    // Create footer with buttons
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 20px;
      border-top: 1px solid #e1e4e8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const info = document.createElement('div');
    info.style.cssText = 'color: #586069; font-size: 14px;';

    const commentCount = (markdown.match(/^## /gm) || []).length;
    info.textContent = `${commentCount} comment${commentCount === 1 ? '' : 's'} extracted`;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 10px;';

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy to Clipboard';
    copyButton.style.cssText = `
      background: #2ea44f;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    `;
    copyButton.onmouseover = () => copyButton.style.background = '#2c974b';
    copyButton.onmouseout = () => copyButton.style.background = '#2ea44f';

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      background: #f6f8fa;
      color: #24292e;
      border: 1px solid #e1e4e8;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    `;
    closeButton.onmouseover = () => closeButton.style.background = '#e1e4e8';
    closeButton.onmouseout = () => closeButton.style.background = '#f6f8fa';

    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(closeButton);

    footer.appendChild(info);
    footer.appendChild(buttonContainer);

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(textareaContainer);
    modal.appendChild(footer);
    backdrop.appendChild(modal);

    // Add event listeners
    const closeModal = () => {
      document.body.removeChild(backdrop);
    };

    header.querySelector('#closeModal').onclick = closeModal;
    closeButton.onclick = closeModal;
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal();
    };

    copyButton.onclick = async () => {
      try {
        await copyToClipboard(textarea.value);
        const originalText = copyButton.textContent;
        copyButton.textContent = '✓ Copied!';
        copyButton.style.background = '#28a745';
        setTimeout(() => {
          copyButton.textContent = originalText;
          copyButton.style.background = '#2ea44f';
        }, 2000);
      } catch (err) {
        copyButton.textContent = '✗ Failed';
        copyButton.style.background = '#d73a49';
        setTimeout(() => {
          copyButton.textContent = 'Copy to Clipboard';
          copyButton.style.background = '#2ea44f';
        }, 2000);
      }
    };

    // Add to DOM
    document.body.appendChild(backdrop);

    // Focus the textarea
    setTimeout(() => textarea.focus(), 100);
  }

  /**
   * Copy text to clipboard with fallback methods
   */
  function copyToClipboard(text) {
    // Method 1: Try modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(err => {
        // If Clipboard API fails, try fallback
        console.warn('Clipboard API failed, trying fallback:', err);
        return copyToClipboardFallback(text);
      });
    }

    // Method 2: Fallback to execCommand
    return copyToClipboardFallback(text);
  }

  /**
   * Fallback clipboard method using execCommand (works in bookmarklets)
   */
  function copyToClipboardFallback(text) {
    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '1px';
      textarea.style.height = '1px';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (successful) {
          resolve();
        } else {
          reject(new Error('execCommand copy failed'));
        }
      } catch (err) {
        document.body.removeChild(textarea);
        reject(err);
      }
    });
  }

  /**
   * Main execution
   */
  async function main() {
    try {
      const data = extractPayload();
      const payload = data.payload;

      if (!payload) {
        throw new Error('Invalid GitHub PR data structure');
      }

      const commentsByFile = extractComments(payload);

      if (commentsByFile.size === 0) {
        alert('No unresolved review comments found on this PR.\n\nNote: The bookmarklet only extracts unresolved comments by default.');
        return;
      }

      const markdown = formatAsMarkdown(commentsByFile);
      showModal(markdown);

      // Also log to console for debugging
      console.log('Extracted comments:', markdown);

    } catch (error) {
      console.error('Error extracting PR comments:', error);
      alert('Error: ' + error.message);
    }
  }

  main();
})();
