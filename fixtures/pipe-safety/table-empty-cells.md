# GFM Table Empty Cells (adjacent-pipe patterns)

Per GFM §4.10, consecutive pipes create empty cells and are valid syntax.
These tables document what the adjacent-pipe diagnostic reports.

## Leading adjacent pipes (empty first cell)

|| Name  | Age |
|| ----- | --- |
|| Alice | 30  |

## Adjacent pipes between columns (empty cell)

| Name  || Age |
| ----- ||--- |
| Bob   || 25  |

## Trailing adjacent pipes (empty trailing cell)

| Name  | Age ||
| ----- | --- ||
| Carol | 28  ||
