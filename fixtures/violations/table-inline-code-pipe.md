# Inline Code Pipe Table Violation

Unescaped pipes inside inline code spans are valid GFM content, but oxfmt/Prettier splits them as table delimiters and corrupts the table. The formatter must block before invoking oxfmt.

| Command | Description |
| --- | --- |
| `cat access.log | grep 500` | Pipeline example |
