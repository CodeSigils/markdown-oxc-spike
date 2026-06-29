# Table Column Drift Violations

## Valid table before

| Name  | Age |
| ----- | --- |
| Alice | 30  |
| Bob   | 25  |

## Column drift: header has 3 cols, delimiter has 4 cols

| Name  | Age | City |
| ----- | --- | --- |
| Carol | 28  | NYC  |

## Column drift: data row has different count than header

| Name  | Age  |
| ----- | ---- |
| Dave  | 35 | Chicago | Denver |
| Erin  | 22 |

## Valid table after

| X | Y |
| - | - |
| 1 | 2 |
