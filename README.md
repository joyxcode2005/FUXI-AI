<div align="center">

# FUXI AI

<h4>FUXI AI is a privacy-first Chrome Extension that transforms your browser into an intelligent, organized, and multilingual workspace. It uses Google's built-in, on-device AI models, including the powerful Gemini Nano, to give you a powerful natural language interface for your tabs — solving the problem of tab chaos without ever sending your personal data to the cloud.
</h4>


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

## Table of Contents

- [The Problem: "Tab Chaos"](#the-problem-tab-chaos)
- [A Better Workflow with FUXI AI](#a-better-workflow-with-fuxi-ai)
- [Privacy-First Architecture (The "MCP" Server)](#privacy-first-architecture-the-mcp-server)
- [APIs Used](#apis-used)
- [How to Use](#how-to-use)
  - [Command Reference](#command-reference)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Extension](#running-the-extension)
- [Contributing](#contributing)
- [License](#license)

---

## The Problem: "Tab Chaos"

We all know the feeling. It's 2 PM, and you're debugging a bug. You have 30 tabs open: your project management tool, two Stack Overflow threads, a GitHub issue, three API docs, a `localhost` tab, and a YouTube tutorial.

Your browser is a mess. You're wasting valuable time and mental energy just *looking* for the one tab you need, and the thought of manually grouping them is exhausting. Existing solutions are often "dumb" (only grouping by domain) or require sending all your browsing data to a third-party server — creating a significant privacy risk.

---

## A Better Workflow with FUXI AI

FUXI AI solves this by acting as your on-device co-pilot. Let's walk through that same scenario:

**Step 1: Instantly Find What You Need**
You press **`Alt+Shift+O`** (or **`MacCtrl+Shift+O`** on Mac) to open FUXI AI. You need to find that specific bug report.
* You type: **"that auth bug"**
* FUXI AI's **AI-Ranked Content Search** instantly scans the *full text* of all 30 tabs. It doesn't just match the title; it finds the bug report by its content and switches you to it instantly.

**Step 2: Intelligently Open New Information**
Now you need to research the bug.
* You type: **"so how to center a dib"**
* The **`Proofreader API`** instantly corrects your typo to "div" *before* you even send the command.
* The **Developer-First Smart Opener** knows "so" means Stack Overflow and opens the top-rated answer in a new tab.
* You type: **"open github react"**. The Smart Opener knows this isn't a tab and opens the `facebook/react` repository.

**Step 3: Magically Clean the Chaos**
Your browser is cluttered again. You click one button: **"Organise Now"**.
* The **AI-Powered "Organise Now"** service kicks in. It doesn't just make a "GitHub" group. It uses the **`Prompt API` (powered by Gemini Nano)** to analyze the *content* of your tabs and creates intelligent, context-aware groups like:
    * `🐛 Debugging Auth Flow` (containing the bug report, Stack Overflow, and GitHub issue)
    * `📚 API Docs` (containing the `npm` pages and your other API docs)
    * `▶️ Tutorials` (containing the YouTube video)
* In 3 seconds, your chaos is gone.

**Step 4: Manage & Internationalize**
You have full control.
* In the **"Groups"** tab, you can rename, delete, or ungroup any of your AI-created groups.
* A colleague from Spain wants to try it. You click the language icon, select **Español**, and the **`Translator API`** instantly translates the *entire UI and chat history* in real-time.

---

## Privacy-First Architecture (The "MCP" Server)

The biggest innovation in FUXI AI is its architecture. It's built as a **client-server application** that runs entirely inside your browser. This enables powerful features while guaranteeing 100% privacy.

-   🧠 **The "MCP" Server (The Brain):** The background script (`src/background/index.js`) acts as a persistent "Master Coordination Platform". It manages the on-device AI, maintains the `Fuse.js` search index, handles all smart-search logic, and manages all state.
-   📱 **The "Client" (The UI):** The popup (`src/popup/App.jsx`) is a lightweight React "client". It's a "dumb" remote control that sends commands (like `organizeNow`) to the MCP server and displays the results.
-   📡 **The "Data Feeder":** The content script (`src/content/extractPageText.js`) privately and securely extracts text from your open tabs and sends it to the MCP server to be added to the *local* search index.

This model means all your data is processed and stored locally. **No browsing history, tab content, or personal data is ever sent to an external server.**

---

## APIs Used

To build this platform, we used three of Google's built-in AI APIs:

-   **`Prompt API` (LanguageModel powered by Gemini Nano):** This is the core engine of our "MCP" server. It powers the AI tab grouping logic, ranks search results to find the most relevant tab, and autocompletes user commands.
-   **`Proofreader API` (Proofreader):** Used in the client interface to automatically correct user typos in the chat bar, ensuring commands are understood even with misspellings.
-   **`Translator API` (Translator):** Used to translate all UI text (buttons, headers) and all chat messages in real-time, making the extension accessible to a global audience.

---

## How to Use

1.  **Open the Interface:** Press **`Alt+Shift+O`** (or **`MacCtrl+Shift+O`** on Mac) to open the extension instantly. You can also click the FUXI AI icon in your Chrome toolbar.
2.  **Organize Tabs Instantly:** Click the **"Organise Now"** button. FUXI AI will immediately analyze your ungrouped tabs and sort them into intelligent groups.
3.  **Find Any Tab:** Type a query into the chat bar at the bottom. You can search for **"react dashboard"** to find your local development tab or **"my auth bug"** to find a specific work item. The AI will find the best match based on the page's full content and switch you to it.
4.  **Open New Sites:** Use the same chat bar to open new sites. Type **"open github react"** to open the official repo, or **"so how to center a div"** to find the top Stack Overflow answer.
5.  **Manage Your Groups:** Click the **"Groups"** button. In this menu, you can see all your groups, rename them with the pencil icon, or delete a group (and close all its tabs) with the trash icon.
6.  **Change Language:** Click the **language icon** (flag) in the top header and select your preferred language. The entire UI and chat history will translate instantly.

### Command Reference

Once loaded, you can use the chat interface to run commands like:

-   `organize` or `organize my tabs`: Automatically groups all ungrouped tabs using AI.
-   `find my auth bug`: Finds a tab based on its content, title, or URL.
-   `react dashboard`: Finds your local project running on `localhost`.
-   `open github react`: Smart-opens the main `facebook/react` repository.
-   `so how to center a div`: Smart-opens the best Stack Overflow answer.
-   `i want to see react tutorial on youtube`: Opens a YouTube search for "react tutorial".
-   `find mail about q4 planning`: Finds the specific open Gmail tab that contains this text.
-   `group all as Work`: Takes all ungrouped tabs and puts them in a new group named "Work".
-   `list groups` or `groups`: Opens the group manager UI.
-   `help`: Displays the full help message inside the chat.

---

## Getting Started

### Prerequisites

This project requires the following to be installed on your local machine:

-   [Node.js](https://nodejs.org/) (v18.0 or higher)
-   [npm](https://www.npmjs.com/) (comes with Node.js)
-   [Google Chrome](https://www.google.com/chrome/) (to install and test the extension)

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

-   **Production Mode:**
    This command will build and minify all files for a production release.
    ```bash
    npm run build
    ```

This command will create a `dist` folder, which is what you will load into Chrome.

#### 2. Load the Extension in Chrome

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable the **"Developer mode"** toggle (usually in the top-right corner).
3.  Click the **"Load unpacked"** button.
4.  Select the `dist` folder that was created inside the `TAB-CLUTTER-FIXER` directory.
5.  The **FUXI AI** icon will appear in your extension toolbar. You're all set!

---

## License

This project is licensed under the GPL License. See the `LICENSE` file for details.