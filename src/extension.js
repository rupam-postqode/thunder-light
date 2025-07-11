"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let currentPanel = undefined;
let outputChannel;
function activate(context) {
    console.log("Thunder Light extension activated!");
    outputChannel = vscode.window.createOutputChannel("Thunder Light");
    const treeDataProvider = new ThunderTreeDataProvider();
    vscode.window.createTreeView("thunder-light.view", { treeDataProvider });
    const openClientCommand = vscode.commands.registerCommand("thunder-light.openClient", () => {
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.One);
        }
        else {
            currentPanel = createWebviewPanel(context);
            setupMessageHandler(currentPanel, context);
        }
    });
    const openViewItemCommand = vscode.commands.registerCommand("thunder-light.openViewItem", () => {
        vscode.commands.executeCommand("thunder-light.openClient");
    });
    // Status bar button
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = "$(rocket) Thunder";
    statusBar.tooltip = "Open Thunder Client";
    statusBar.command = "thunder-light.openClient";
    statusBar.show();
    context.subscriptions.push(openClientCommand, openViewItemCommand, statusBar, outputChannel);
}
class ThunderTreeDataProvider {
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        const openItem = new vscode.TreeItem("Open Thunder Client");
        openItem.command = {
            command: "thunder-light.openViewItem",
            title: "Open Thunder Client",
        };
        openItem.iconPath = new vscode.ThemeIcon("rocket");
        return Promise.resolve([openItem]);
    }
}
function createWebviewPanel(context) {
    const panel = vscode.window.createWebviewPanel("thunderView", "Thunder Client", vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "media", "webview"),
        ],
    });
    panel.webview.html = getWebviewContent(panel, context);
    panel.onDidDispose(() => {
        currentPanel = undefined;
    }, null, context.subscriptions);
    return panel;
}
function getWebviewContent(panel, context) {
    const basePath = path.join(context.extensionPath, "media", "webview");
    const indexPath = path.join(basePath, "index.html");
    if (!fs.existsSync(indexPath)) {
        return `<html><body><h1>Error: UI not found</h1><p>Run: npm run build-webview</p></body></html>`;
    }
    let html = fs.readFileSync(indexPath, "utf8");
    const webview = panel.webview;
    const resourceRoot = webview
        .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "webview"))
        .toString();
    html = html.replace(/(href|src)="([^"]*)"/g, (match, tag, resourcePath) => {
        if (/^(http|data:|#)/.test(resourcePath))
            return match;
        const absPath = vscode.Uri.joinPath(vscode.Uri.file(basePath), resourcePath);
        return `${tag}="${webview.asWebviewUri(absPath)}"`;
    });
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline';">`;
    const initScript = `<script>window.vscode = acquireVsCodeApi();</script>`;
    html = html.replace("</head>", `${csp}</head>`);
    html = html.replace("</body>", `${initScript}</body>`);
    return html;
}
function setupMessageHandler(panel, context) {
    panel.webview.onDidReceiveMessage(async (message) => {
        const { command, id, method, url, headers, body } = message;
        switch (command) {
            case "sendRequest":
                try {
                    const response = await sendHttpRequest(method, url, headers, body);
                    panel.webview.postMessage({
                        command: "showResponse",
                        id,
                        data: response,
                    });
                }
                catch (err) {
                    const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
                    panel.webview.postMessage({
                        command: "showError",
                        id,
                        data: errorMsg,
                    });
                    outputChannel.appendLine(`[ERROR] ${errorMsg}`);
                }
                break;
        }
    }, undefined, context.subscriptions);
}
async function sendHttpRequest(method, url, headers = {}, body = "") {
    return new Promise((resolve, reject) => {
        if (!/^https?:\/\//.test(url)) {
            reject("Only HTTP(S) URLs are supported");
            return;
        }
        const protocol = url.startsWith("https") ? https : http;
        const req = protocol.request(url, {
            method,
            headers: {
                "User-Agent": "Thunder-Light/1.0",
                Accept: "application/json",
                ...headers,
            },
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk.toString();
            });
            res.on("end", () => {
                const responseStr = `HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}
${formatHeaders(res.headers)}

${data}`;
                outputChannel.appendLine(`[REQUEST] ${method} ${url}`);
                outputChannel.appendLine(`[RESPONSE]\n${responseStr}`);
                resolve(responseStr);
            });
        });
        req.on("error", (error) => {
            outputChannel.appendLine(`[ERROR] ${error.message}`);
            reject(error);
        });
        if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && body) {
            req.write(body);
        }
        req.end();
    });
}
function formatHeaders(headers) {
    return Object.entries(headers)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join("\n");
}
//# sourceMappingURL=extension.js.map