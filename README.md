<div align="center">

# FUXI AI

<h3>Streamline Browsing, Master Your Digital World</h3>

<p>
  <img src="https://img.shields.io/badge/last%20commit-today-00AEFF?style=for-the-badge&logo=git&logoColor=white" alt="Last Commit">
  <img src="https://img.shields.io/badge/javascript-98.1%25-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/languages-3-blue?style=for-the-badge" alt="Languages">
</p>

<h3>Built with the tools and technologies:</h3>

<p>
  <img src="https://img.shields.io/badge/JSON-000000?style=for-the-badge&logo=json&logoColor=white" alt="JSON">
  <img src="https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white" alt="Markdown">
  <img src="https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="NPM">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/YAML-CB171E?style=for-the-badge&logo=yaml&logoColor=white" alt="YAML">
</p>

</div>

## Table of Content

- [Overview](#overview)
- [Core Features](#core-features)
- [Privacy-First Architecture (The "MCP" Server)](#privacy-first-architecture-the-mcp-server)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Extension](#running-the-extension)
- [How to Use (Commands)](#how-to-use-commands)
- [Contributing](#contributing)
- [License](#license)

## Overview

We all know the feeling: dozens of tabs, total chaos. You know the one document or ticket you need is open... *somewhere*.

**FUXI AI** is a Chrome extension that fixes this. It's not just another tab manager; it's an intelligent assistant that runs **100% on-device**, ensuring your data remains completely private.

It uses on-device AI to understand the *content* of your pages, allowing you to instantly organize your workspace with a single command and find any tab—even `localhost` projects or specific Gmail threads—with natural language.

---

## Core Features

- 🧠 **Privacy-First AI Grouping:** Uses Google's on-device `LanguageModel` to analyze and group your open tabs by context. Your tab data **never leaves your machine**.
- 🔍 **Content-Aware Search:** FUXI AI builds a private, local search index of the *full text* of your web pages. You can instantly find any tab by its content, not just its title.
- 🚀 **Smart Opener:** Understands "developer intent." Ask to `open github react` and it takes you to the `facebook/react` repo, not a search page. Ask `i want to see react tutorial on youtube` and it opens the correct search.
- 📧 **Gmail Context Search:** The content-aware search is powerful enough to scan your open Gmail tabs. Find a specific email by typing `find mail about q4 planning`.
- 💬 **Chat-Based UI:** An intuitive, chat-like interface makes managing your browser as
  easy as sending a message.

---

## Privacy-First Architecture (The "MCP" Server)

The biggest innovation in FUXI AI is its architecture. It's built as a **client-server application** that runs entirely inside your browser. This enables powerful features while guaranteeing 100% privacy.

- 🧠 **The "MCP" Server (The Brain):** The background script (`src/background/index.js`) acts as a persistent "Master Coordination Platform". It manages the on-device AI, maintains the `Fuse.js` search index, handles all smart-search logic, and manages all state.
- 📱 **The "Client" (The UI):** The popup (`src/popup/App.jsx`) is a lightweight React "client". It's a "dumb" remote control that sends commands (like `organizeNow`) to the MCP server and displays the results.
- 📡 **The "Data Feeder":** The content script (`src/content/extractPageText.js`) privately and securely extracts text from your open tabs and sends it to the MCP server to be added to the *local* search index.

This model means all your data is processed and stored locally. **No browsing history, tab content, or personal data is ever sent to an external server.**

---

## Getting Started

### Prerequisites

This project requires the following to be installed on your local machine:

- [Node.js](https://nodejs.org/) (v18.0 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Google Chrome](https://www.google.com/chrome/) (to install and test the extension)

### Installation

Build FUXI AI from the source and install dependencies:

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/joyxcode2005/TAB-CLUTTER-FIXER](https://github.com/joyxcode2005/TAB-CLUTTER-FIXER)
    ```

2.  **Navigate to the project directory:**

    ```bash
    cd TAB-CLUTTER-FIXER
    ```

3.  **Install the dependencies:**

    ```bash
    npm install
    ```

---

### Running the Extension

#### 1. Build the Extension

You can build the extension in two ways:



-   **Production Mode:**
    This command will build and minify all files for a production release.
    ```bash
    npm run build
    ```

Both commands will create a `dist` folder, which is what you will load into Chrome.

#### 2. Load the Extension in Chrome

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable the **"Developer mode"** toggle (usually in the top-right corner).
3.  Click the **"Load unpacked"** button.
4.  Select the `dist` folder that was created inside the `TAB-CLUTTER-FIXER` directory.
5.  The **FUXI AI** (AI TABS) icon will appear in your extension toolbar. You're all set!

---

## How to Use (Commands)

Once loaded, click the extension icon. You can use the chat interface to run commands like:

-   `organize` or `organize my tabs`: Automatically groups all ungrouped tabs using AI.
-   `find my-jira-ticket-123`: Finds a tab based on its content, title, or URL.
-   `react dashboard`: Finds your local project running on `localhost:3000`.
-   `open github react`: Smart-opens the main `facebook/react` repository.
-   `so how to center a div`: Smart-opens the best Stack Overflow answer.
-   `i want to see react tutorial on youtube`: Opens a YouTube search for "react tutorial".
-   `find mail about q4 planning`: Finds the specific open Gmail tab that contains this text.
-   `group all as Work`: Takes all ungrouped tabs and puts them in a new group named "Work".
-   `list groups` or `groups`: Opens the group manager UI.
-   `help`: Displays the full help message inside the chat.

---

## Contributing

Contributions are welcome! If you have ideas for new features, find a bug, or want to improve the code, please feel free to:

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.