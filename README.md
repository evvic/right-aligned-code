
## Right-Align Code

![Right-Aligned Code Demo](assets/right-aligned-demo.gif)

Keep your code aligned to the right!

Right-Aligned Code is a Visual Studio Code extension that automatically pads or trims the left side of lines so that the visible content (ignoring leading whitespace) of every line ends at the same column as the longest content line in the document. In short: it keeps code right-aligned by adding or removing leading spaces as you edit.

## Features

- Live right-alignment: the extension updates padding as you edit so shorter lines end at the same content column as the longest line.
- Content-aware: alignment is based on the length of the line content (leading whitespace is ignored when measuring line length).
- Cursor preservation: when padding changes, the extension tries to keep your caret(s) and selection(s) at the same character in the content so typing remains natural.
- Undo-friendly: automatic padding edits are merged with the user's edit in the undo stack so a single Ctrl+Z will revert typing plus the auto-alignment.

## How it works (short)

1. On text changes the extension computes each line's content length (line length minus leading whitespace) and finds the maximum content length.
2. For every line it computes a desired amount of leading spaces so content ends at the same column as the longest line. It replaces the existing leading whitespace with the desired number of spaces.
3. When the extension modifies leading whitespace it adjusts the editor selections so carets stay positioned relative to the content.
4. The extension uses a small debounce and safeguards to avoid interfering with in-flight typing; if you type extremely fast there are protections to minimize races and avoid character reordering.


## Known limitations & notes

- Tabs vs spaces: the extension measures leading whitespace as code units (characters). If your file uses tabs, alignment is done by character count, not visual columns. Visual alignment with mixed tabs/spaces may look off.
- Extreme rapid typing: we put protections in place (cursor-preservation and small debounces), but in extremely high-frequency typing there is still a small chance of race conditions. A configurable small grace window eliminates these reliably at the cost of a tiny delay.
- Structure-ignorant: alignment is purely based on leading whitespace and content length — it does not attempt to parse language syntax or align by semantic columns.

## Troubleshooting

- If automatic edits feel intrusive, try disabling the extension in the Extension Development Host and re-enable it after making changes, or request a configuration option to align only on save or only for visible lines.
- If undo behaves unexpectedly, ensure you are running a recent build — the extension merges its edits into the undo stack so a single Ctrl+Z should undo both your typing and the auto-alignment.

## Contribution

Contributions, bug reports and feature requests are welcome. Open an issue or a pull request on the repository describing a reproducible scenario.

### Configuration

At the moment the extension exposes no user settings. If you'd like different timing or behavior (e.g., a small grace window before aligning an actively edited line), we can add scoped configuration options such as:

- `rightAlignedCode.graceMillis` — milliseconds to wait before editing a line that was just changed (helps eliminate rare typing races)
- `rightAlignedCode.debounceMillis` — debounce interval for alignment runs

If you want these added I can wire them up to the extension settings and apply them to the live alignment logic.

### Quick start — develop & test

1. Install dependencies:

```bash
npm install
```

2. Build the extension bundle (used by the Extension Development Host):

```bash
npm run compile
```

3. Launch the Extension Development Host from VS Code (Run → Start Debugging) to test in a new window. Edit files there and watch the right-alignment behavior.

4. Run tests (if present):

```bash
npm test
```

## License

This project is released under the MIT License. See `LICENSE.txt` for details.

Enjoy — let me know if you'd like a per-line grace window or a setting to tune alignment latency.

