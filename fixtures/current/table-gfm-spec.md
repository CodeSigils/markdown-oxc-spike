# GFM Table Spec Coverage

Representative GFM table forms that the spike guard should accept.

## Leading and Trailing Pipes

| Foo | Bar |
| --- | --- |
| Baz | Bim |

## No Leading or Trailing Pipes

| Foo | Bar |
| --- | --- |
| Baz | Bim |

## Escaped Pipes

| Case                | Value           |
| ------------------- | --------------- |
| escaped pipe        | alpha \| beta   |
| inline escaped pipe | `alpha \| beta` |

## Header and Delimiter Only

| Empty body | Still table |
| ---------- | ----------- |

## Blank Line Terminates Table

| Name | Value |
| ---- | ----- |
| A    | B     |

| New | Table |
| --- | ----- |
| C   | D     |
