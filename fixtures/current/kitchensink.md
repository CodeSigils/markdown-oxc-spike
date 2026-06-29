# Markdown Lint Test Kitchen Sink

This file contains various markdown constructs to test the linting pipeline.

---

## Tables

### Basic Table

| Name    | Age | Role      |
| :------ | --: | :-------- |
| Alice   |  25 | Developer |
| Bob     |  30 | Designer  |
| Charlie |  28 | Manager   |

### Table with Trailing Pipe

| Feature | Status | Notes         |
| :------ | :----- | :------------ |
| MD055   | ✅     | Trailing pipe |
| MD060   | ✅     | Alignment     |
| MD040   | ✅     | Blank fence   |

### Emoji Columns (tests string-width)

| Emoji | Description | Code Point |
| :---- | :---------- | :--------- |
| 🚀    | Rocket      | U+1F680    |
| ✅    | Check mark  | U+2705     |
| ⚠️    | Warning     | U+26A0     |
| 🔧    | Wrench      | U+1F527    |

### CJK Characters (tests double-width)

| 言語   | 状態   | バージョン |
| :----- | :----- | :--------- |
| 日本語 | Active | 2.6        |
| 中文   | Active | 2.6        |
| 한국어 | Active | 2.6        |

### Mixed Content

| Type  | Sample    | Width |
| :---- | :-------- | :---- |
| Emoji | 🌍🌎🌏    | 6     |
| CJK   | 日本語    | 6     |
| Mixed | Hello世界 | 8     |

### Alignment Variations

| Left | Center | Right |
| :--- | :----: | ----: |
| ←    |   ◆    |     → |
| left | center | right |

---

## Code Blocks

### Fenced Code

```text
function hello() {
  console.log("Hello, World!");
}
```

### Blank Fence (allowed)

```text
No language specified
This is output or placeholder
```

### With Language

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n-1) + fib(n-2)
```

---

## Lists

### Unordered List

- Item one
- Item two
  - Nested item
  - Another nested
- Item three

### Ordered List

1. First step
2. Second step
3. Third step

### Task List

- [x] Completed task
- [ ] Pending task
- [ ] Another pending

---

## Blockquotes

> This is a blockquote Across multiple lines
>
> With a blank line in between

---

## Emphasis

### Bold and Italic

**Bold text** and _italic text_ and **_bold italic_**.

### Inline Code

Run `npm install` to install dependencies.

---

## Horizontal Rules

---

## Links

[GitHub](https://github.com)

[Link with title](https://example.com "Title")

---

## Raw Table (before fix)

| Header |
| :----- |
| data   |

---

## Summary

| Rule  | Purpose          |
| :---- | :--------------- |
| MD055 | Trailing pipes   |
| MD060 | Column alignment |
| MD040 | Code fence lang  |
