# Fence Mismatch Violations

## Valid markdown before

## Unclosed fence

This code block never closes:

```
const x = 1;

## Valid markdown after

## Mismatched fence length (opens with 3 backticks, closes with 4 tildes)

```
const y = 2;
~~~~

## Style mismatch (opens with tilde, closes with backtick)

~~~
const z = 3;
```

## Normal valid fence

```
const valid = 4;
```
