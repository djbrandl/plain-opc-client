# Plain OPC UA Client

A lightweight, no-frills OPC UA Client. Connect to servers, browse nodes, and monitor data in real-time.

**GitHub Repository:** [https://github.com/djbrandl/plain-opc-client](https://github.com/djbrandl/plain-opc-client)

![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## 🚀 Getting Started

Follow these instructions to get the application running on your local machine.

### 1. Prerequisites
Before you begin, ensure you have **Node.js** installed.
*   **Download Node.js:** [https://nodejs.org/](https://nodejs.org/) (Download the "LTS" version).
*   **Verify Installation:** Open your terminal (Command Prompt or PowerShell) and type:
    ```bash
    node -v
    npm -v
    ```
    If these commands return version numbers, you are ready.

### 2. Installation
Open your terminal in the project folder and run this single command. It will automatically set up the main project, client, and server.

```bash
npm install
```

### 3. Running the Application
To start the app, ensure you are in the root folder (where this README file is) and run:

```bash
npm run dev
```

*   This will start both the **Backend Server** and the **Frontend Interface**.
*   Your browser should automatically open `http://localhost:5173`.
*   If it doesn't, manually open that link in Chrome, Firefox, or Edge.

---

## ⚙️ Configuration (Changing the Port)

You can easily change the port the backend server runs on (default is `3001`) by editing a single file.

1.  Open the file named **`server_config.json`** located in the main project folder.
2.  Change the number next to `"port"`:
    ```json
    {
      "port": 3001
    }
    ```
3.  **Save the file.**
4.  **Restart the application:**
    *   Go to your terminal where the app is running.
    *   Press `Ctrl + C` to stop it.
    *   Run `npm run dev` again.

The application will now use the new port automatically. The frontend will adjust itself, so you don't need to change any code.

---

## 📖 How to Use

1.  **Connect:**
    *   In the "Connection" panel (left sidebar), enter your OPC UA Server URL (e.g., `opc.tcp://localhost:4840`).
    *   Click **Connect**.
2.  **Browse:**
    *   Use the tree view to explore the folders (Objects, Devices, etc.).
3.  **Monitor:**
    *   **Single Item:** Select a "Variable" (cyan text) and click **+ Monitor**.
    *   **Bulk Monitor:** Select a "Folder" (white text) and click **+ Monitor All**.
    *   View live data in the main table on the right.

## License
MIT