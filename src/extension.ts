import * as vscode from "vscode";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  // Register Thunder Client view
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
          "Open Thunder Client",
          vscode.TreeItemCollapsibleState.None
        ),
      ]);
    }
  }
}

function createPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "thunderView",
    "Thunder Client",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "media", "webview"),
      ],
    }
  );

  panel.webview.html = getWebviewContent(panel, context);

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

function getWebviewContent(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext
): string {
  const webview = panel.webview;
  const basePath = vscode.Uri.joinPath(
    context.extensionUri,
    "media",
    "webview"
  );
  const indexPath = vscode.Uri.joinPath(basePath, "index.html").fsPath;

  let html = fs.readFileSync(indexPath, "utf8");

  // Update resource paths to use webview URIs
  html = html.replace(
    /(href|src)="([^"]*)"/g,
    (_, tag, path) =>
      `${tag}="${webview.asWebviewUri(vscode.Uri.joinPath(basePath, path))}"`
  );

  // Add CSP meta tag
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline';">`;
  html = html.replace("</head>", `${csp}</head>`);

  // Add vscode API initialization
  const initScript = `<script>window.vscode = acquireVsCodeApi();</script>`;
  html = html.replace("</body>", `${initScript}</body>`);

  return html;
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
              command: "showError",
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
