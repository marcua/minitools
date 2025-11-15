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
   * Extract line range from suggestion HTML (for multi-line suggestions)
   * Returns {start, end} or null if not a suggestion or can't parse
   */
  function extractSuggestionLineRange(bodyHTML) {
    if (!bodyHTML || !bodyHTML.includes('js-suggested-changes-blob')) {
      return null;
    }

    // Extract all line numbers from data-line-number attributes
    const lineNumbers = [];
    const regex = /data-line-number="(\d+)"/g;
    let match;
    while ((match = regex.exec(bodyHTML)) !== null) {
      lineNumbers.push(parseInt(match[1], 10));
    }

    if (lineNumbers.length === 0) {
      return null;
    }

    // Get unique line numbers and find min/max
    const uniqueLines = [...new Set(lineNumbers)].sort((a, b) => a - b);
    return {
      start: uniqueLines[0],
      end: uniqueLines[uniqueLines.length - 1]
    };
  }

  /**
   * Extract diff from suggestion HTML
   * Returns {oldLines, newLines} or null
   */
  function extractSuggestionDiff(bodyHTML) {
    if (!bodyHTML || !bodyHTML.includes('js-suggested-changes-blob')) {
      return null;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(bodyHTML, 'text/html');

    const oldLines = [];
    const newLines = [];

    // Extract deletion lines (old code)
    const deletionCells = doc.querySelectorAll('.blob-code-deletion');
    deletionCells.forEach(cell => {
      oldLines.push(cell.textContent.trim());
    });

    // Extract addition lines (new code)
    const additionCells = doc.querySelectorAll('.blob-code-addition');
    additionCells.forEach(cell => {
      newLines.push(cell.textContent.trim());
    });

    return { oldLines, newLines };
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
          // Check for multi-line range in different formats:
          // 1. thread.startLine/endLine (for some thread types)
          // 2. thread.start + marker (for multi-line non-suggestion comments)
          let hasMultiLine = false;
          let startLine = lineFromMarker;
          let endLine = lineFromMarker;

          if (thread.startLine !== undefined && thread.endLine !== undefined) {
            // Format 1: explicit startLine/endLine properties
            hasMultiLine = true;
            startLine = thread.startLine;
            endLine = thread.endLine;
          } else if (thread.start) {
            // Format 2: thread.start marker + current marker
            hasMultiLine = true;
            startLine = parseLineFromMarker(thread.start);
            endLine = lineFromMarker;
          }

          map.set(thread.id.toString(), {
            filePath: filePath,
            marker: marker,
            line: hasMultiLine ? null : lineFromMarker,  // Only set single line if not multi-line
            contextStart: hasMultiLine ? startLine : contextStart,
            contextEnd: hasMultiLine ? endLine : contextEnd
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
        // Check if this is a multi-line suggestion and extract the actual line range
        const suggestionRange = extractSuggestionLineRange(comment.bodyHTML);
        const suggestionDiff = extractSuggestionDiff(comment.bodyHTML);

        const commentData = {
          line: suggestionRange ? null : location.line,  // No single line for multi-line suggestions
          marker: location.marker,
          contextStart: suggestionRange ? suggestionRange.start : location.contextStart,
          contextEnd: suggestionRange ? suggestionRange.end : location.contextEnd,
          author: comment.author?.login || 'Unknown',
          body: comment.body || '',
          bodyHTML: comment.bodyHTML || '',
          suggestionDiff: suggestionDiff,
          createdAt: comment.createdAt
        };

        commentsByFile.get(filePath).push(commentData);
        extractedThreads++;
      });
    });

    return commentsByFile;
  }

  /**
   * Format suggestion as a diff
   */
  function formatSuggestionDiff(suggestionDiff) {
    if (!suggestionDiff) {
      return '';
    }

    const { oldLines, newLines } = suggestionDiff;
    let diff = '';

    // Add removed lines
    if (oldLines.length > 0) {
      diff += oldLines.map(line => `- ${line}`).join('\n');
    }

    // Add separator if we have both old and new lines
    if (oldLines.length > 0 && newLines.length > 0) {
      diff += '\n';
    }

    // Add added lines
    if (newLines.length > 0) {
      diff += newLines.map(line => `+ ${line}`).join('\n');
    }

    return diff;
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

        // If this is a suggestion with diff, format as diff
        if (comment.suggestionDiff) {
          const diff = formatSuggestionDiff(comment.suggestionDiff);
          if (diff) {
            markdown += '```diff\n';
            markdown += diff + '\n';
            markdown += '```\n\n';
          }
        } else {
          // For non-suggestion comments, just add the body
          markdown += `${comment.body}\n\n`;
        }

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

    } catch (error) {
      console.error('Error extracting PR comments:', error);
      alert('Error: ' + error.message);
    }
  }

  main();
})();
