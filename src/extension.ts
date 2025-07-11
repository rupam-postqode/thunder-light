import * as vscode from "vscode";
import * as https from "https";

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  // Register Thunder  view
  const treeDataProvider = new ThunderTreeDataProvider();
  vscode.window.registerTreeDataProvider(
    "thunder-light.view",
    treeDataProvider
  );

  // Register command to open Thunder Client panel
  context.subscriptions.push(
    vscode.commands.registerCommand("thunder-light.openClient", () => {
      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
      } else {
        currentPanel = createPanel(context);
        setupMessageHandler(currentPanel, context);
      }
    })
  );
}

class ThunderTreeDataProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    } else {
      return Promise.resolve([
        new vscode.TreeItem(
          "Open Thunder Light",
          vscode.TreeItemCollapsibleState.None
        ),
      ]);
    }
  }
}

function createPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "thunderView",
    "Thunder Light",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  panel.webview.html = getWebviewContent();

  // Handle panel disposal
  panel.onDidDispose(
    () => {
      currentPanel = undefined;
    },
    null,
    context.subscriptions
  );

  return panel;
}

function setupMessageHandler(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext
) {
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case "sendRequest":
          try {
            const response = await handleRequest(message.method, message.url);
            panel.webview.postMessage({
              command: "showResponse",
              data: response,
            });
          } catch (error) {
            panel.webview.postMessage({
              command: "showResponse",
              data: `Error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            });
          }
          return;
      }
    },
    undefined,
    context.subscriptions
  );
}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thunder Light</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
        }
        .request-form {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            align-items: center;
        }
        #method {
            width: 100px;
            padding: 8px;
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
        }
        #url {
            flex: 1;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
        }
        #send-btn {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }
        #send-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .response-container {
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            overflow: hidden;
            height: calc(100vh - 150px);
            display: flex;
            flex-direction: column;
        }
        #response {
            padding: 15px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            overflow: auto;
            flex-grow: 1;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
        }
        .status-bar {
            padding: 5px 10px;
            background-color: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>Thunder Light</h1>
    <div class="request-form">
        <select id="method">
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
        </select>
        <input type="text" id="url" placeholder="https://api.example.com/resource">
        <button id="send-btn">Send</button>
    </div>
    <div class="response-container">
        <div class="status-bar">Response</div>
        <pre id="response">Response will appear here...</pre>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const methodSelect = document.getElementById('method');
        const urlInput = document.getElementById('url');
        const sendButton = document.getElementById('send-btn');
        const responsePre = document.getElementById('response');

        sendButton.addEventListener('click', () => {
            const method = methodSelect.value;
            const url = urlInput.value;
            
            if (!url) {
                responsePre.textContent = 'Please enter a URL';
                return;
            }

            responsePre.textContent = 'Sending request...';
            
            vscode.postMessage({
                command: 'sendRequest',
                method: method,
                url: url
            });
        });

        // Handle Enter key in URL field
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendButton.click();
            }
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'showResponse') {
                try {
                    // Try to format as JSON if possible
                    const parsed = JSON.parse(message.data);
                    responsePre.textContent = JSON.stringify(parsed, null, 2);
                } catch {
                    // If not JSON, display as plain text
                    responsePre.textContent = message.data;
                }
            }
        });
        
        // Focus URL field on load
        urlInput.focus();
    </script>
</body>
</html>`;
}

async function handleRequest(method: string, url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate URL format
    if (!url.startsWith("https://")) {
      reject("Only HTTPS URLs are supported");
      return;
    }

    const req = https.request(
      url,
      {
        method: method,
        headers: {
          "User-Agent": "Thunder-Light/1.0",
          Accept: "application/json",
        },
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              `HTTP Error ${res.statusCode}: ${res.statusMessage}\n${data}`
            );
          } else {
            // Include status line in response
            resolve(
              `HTTP/${res.httpVersion} ${res.statusCode} ${
                res.statusMessage
              }\n${formatHeaders(res.headers)}\n\n${data}`
            );
          }
        });
      }
    );

    req.on("error", (error) => {
      reject(`Request failed: ${error.message}`);
    });

    req.end();
  });
}

function formatHeaders(headers: Record<string, unknown>): string {
  return Object.entries(headers)
    .map(
      ([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
    )
    .join("\n");
}
