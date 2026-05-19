```js
const markdown = `
# Heading

- List item 1
- List item 2

\`\`\`js
console.log("code inside fence");
\`\`\`

> Blockquote
>
> With multiple lines

| Table | Header |
|-------|--------|
| Cell 1 | Cell 2 |
`;

function processMarkdown() {
  return markdown.trim();
}
```
