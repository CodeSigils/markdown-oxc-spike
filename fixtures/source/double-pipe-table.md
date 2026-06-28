# GFM Table Empty Cells (double-pipe patterns)

Per GFM §4.10, consecutive pipes create empty cells and are valid syntax.
These tables test that Oxfmt preserves this structure correctly.

## Leading double pipe (empty first cell)

|| Name | Age |
|| ----- | --- |
|| Alice | 30 |
|| Bob | 25 |

## Internal adjacent pipes (empty cell between columns)

| Name || Age | City |
| ----- ||--- | ------- |
| Carol || 28 | NYC |
| Dave || 35 | Chicago |

## Trailing double pipe (empty trailing cell)

| Name | Age ||
| ----- | --- ||
| Erin | 22 ||
| Frank | 40 ||

## Valid table (no empty cells — should pass)

| Name  | Age | City    |
| :---- | :-: | :------ |
| Grace | 28  | Boston  |
| Heidi | 32  | Seattle |
