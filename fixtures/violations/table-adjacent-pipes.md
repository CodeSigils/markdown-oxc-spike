# Table with adjacent pipes

Adjacent pipes (||) create empty cells. oxfmt cannot safely format these
because it expands the column count and corrupts the table.

| Name  | Age | City   |
|-------|-----|--------|
| Alice | 30  | NYC    |
|| Bob  | 25  | London |
| Carol | 28  | Paris  |
