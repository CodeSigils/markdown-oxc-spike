# Nested Fences

Outer Markdown fence containing an inner text fence:

````markdown
```text
inside nested text fence
```

Paragraph after the inner fence.
````

Outer tilde fence containing nested backtick fences:

`````markdown
````markdown
```text
deeply nested text fence
```
````
`````

List item with a nested Markdown example:

- Keep the outer fence longer than the inner fence.

  ````markdown
  ```bash
  npm test
  ```
  ````
