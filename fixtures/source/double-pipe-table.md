# Double-Pipe Table (adjacent pipes)

## Leading double pipe (phantom empty first column)

|| Name | Age |
|| ----- | --- |
|| Alice | 30 |
|| Bob | 25 |

## Internal double pipe (adjacent pipes between cells)

| Name || Age | City |
| ----- ||--- | ------- |
| Carol || 28 | NYC |
| Dave || 35 | Chicago |

## Trailing double pipe (phantom trailing column)

| Name | Age ||
| ----- | --- ||
| Erin | 22 ||
| Frank | 40 ||

## Valid table (no double pipes — should pass)

| Name  | Age | City    |
| :---- | :-: | :------ |
| Grace | 28  | Boston  |
| Heidi | 32  | Seattle |
