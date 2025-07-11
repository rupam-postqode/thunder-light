import React, { useState, useEffect } from "react";
import RequestForm from "./components/RequestForm";
import ResponseView from "./components/ResponseView";
import "./App.css";

function App() {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      if (message.command === "showResponse") {
        setResponse(message.data);
        setError(null);
      } else if (message.command === "showError") {
        setError(message.data);
        setResponse(null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleSendRequest = (method, url) => {
    setResponse("Sending request...");
    setError(null);

    if (window.vscode) {
      window.vscode.postMessage({
        command: "sendRequest",
        method,
        url,
      });
    }
  };

  return (
    <div className="app">
      <h1>Thunder Client</h1>
      <RequestForm onSendRequest={handleSendRequest} />
      <ResponseView response={response} error={error} />
    </div>
  );
}

export default App;
