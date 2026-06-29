# Hermes Agent Introduction

Hermes is an open-source AI agent framework designed for developers who want flexibility and control over their
AI-powered workflows.

## Why Hermes?

| Feature        | Description                                                |
| :------------- | :--------------------------------------------------------- |
| Multi-provider | Works with OpenAI, Anthropic, Ollama, OpenRouter, and more |
| Skill system   | Extend capabilities with reusable skill modules            |
| Memory         | Cross-session memory that persists context                 |
| MCP support    | Connect to Model Context Protocol servers                  |

## Quick Example

```python
from hermes import Agent

agent = Agent(model="claude-3-5-sonnet")
response = agent.chat("Hello, world!")
print(response)
```

## Core Concepts

- **Agents**: The main unit of work — conversational AI with tool access
- **Skills**: Reusable task definitions that agents can load on demand
- **Providers**: Abstraction over LLM APIs — swap models without changing code
- **Memory**: Persistent context across sessions using vector storage

## Installation

```bash
pip install hermes-ai
```

## Configuration

Create a `config.yaml` in your project root:

```yaml
model:
  provider: openai
  name: gpt-4o

skills:
  - markdown-lint
  - code-review
  - spike
```

## Supported Models

| Provider   | Models                                  |
| :--------- | :-------------------------------------- |
| OpenAI     | GPT-4o, GPT-4o Mini, o1-preview         |
| Anthropic  | Claude 3.5 Sonnet, Claude 3 Opus        |
| Ollama     | Any local model (qwen, llama3, mistral) |
| OpenRouter | 100+ models through unified API         |

---

For more information, visit the [official docs](https://hermes-ai.dev).
