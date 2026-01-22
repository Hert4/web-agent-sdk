# Web Agent SDK

Universal Web Agent SDK - AI-powered browser automation that works on any webpage. Built on top of LangChain, it provides a robust Planner-Actor architecture to reliably execute complex tasks.

## Features

- 🧠 **Planner-Actor Architecture**: Automatically plans, executes, and verifies tasks to prevent loops and errors.
- 🚀 **Universal Compatibility**: Works with Google Gemini, OpenAI (GPT-4), Anthropic Claude, and custom providers (Ollama, vLLM).
- 🛡️ **Robust Fallbacks**: Automatically handles API errors (like 400 Bad Request) by switching execution strategies.
- ⚡ **Batch Actions**: Executes multiple actions in parallel for speed.
- 🎯 **Smart DOM Analysis**: Intelligently finds elements and verifies input values.
- 🧩 **Custom Skills**: Inject custom instructions to guide the agent's behavior.

## Installation

```bash
npm install web-agent-sdk
# Install peer dependencies as needed
npm install @langchain/core @langchain/openai @langchain/google-genai
```
