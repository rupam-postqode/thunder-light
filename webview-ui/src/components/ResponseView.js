import React, { useState, useEffect } from "react";

function ResponseView({ response, error }) {
  const [statusLine, setStatusLine] = useState("");
  const [headers, setHeaders] = useState({});
  const [body, setBody] = useState("");
  const [rawBody, setRawBody] = useState("");
  const [isJson, setIsJson] = useState(false);
  const [activeTab, setActiveTab] = useState("body");

  useEffect(() => {
    if (error) {
      setStatusLine("Error");
      setHeaders({});
      setBody(error);
      setRawBody(error);
      setIsJson(false);
      return;
    }

    if (!response) {
      setStatusLine("");
      setHeaders({});
      setBody("Response will appear here...");
      setRawBody("");
      setIsJson(false);
      return;
    }

    const [statusAndHeaders, ...bodyParts] = response.split("\n\n");
    const [status, ...headerLines] = statusAndHeaders.split("\n");

    const headerObj = {};
    headerLines.forEach((line) => {
      const [key, ...valParts] = line.split(":");
      if (key && valParts.length) {
        headerObj[key.trim()] = valParts.join(":").trim();
      }
    });

    const raw = bodyParts.join("\n\n").trim();
    let formatted = raw;
    let jsonParsed = false;

    try {
      const json = JSON.parse(raw);
      formatted = JSON.stringify(json, null, 2);
      jsonParsed = true;
    } catch {
      formatted = raw;
    }

    setStatusLine(status);
    setHeaders(headerObj);
    setBody(formatted);
    setRawBody(raw);
    setIsJson(jsonParsed);
  }, [response, error]);

  return (
    <div className="response-box">
      <div className="status-line">
        {statusLine || "Waiting for response..."}
      </div>

      <div className="tabs">
        <button
          onClick={() => setActiveTab("body")}
          className={activeTab === "body" ? "active" : ""}
        >
          Body
        </button>
        <button
          onClick={() => setActiveTab("headers")}
          className={activeTab === "headers" ? "active" : ""}
        >
          Headers
        </button>
        <button
          onClick={() => setActiveTab("raw")}
          className={activeTab === "raw" ? "active" : ""}
        >
          Raw
        </button>
      </div>

      <div className="response-content">
        {activeTab === "headers" && (
          <pre className="headers">
            {Object.entries(headers)
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n") || "No headers"}
          </pre>
        )}

        {activeTab === "body" && (
          <pre className={`body ${isJson ? "json" : ""}`}>
            {body || "No body content"}
          </pre>
        )}

        {activeTab === "raw" && (
          <pre className="raw">{response || "No raw data"}</pre>
        )}
      </div>
    </div>
  );
}

export default ResponseView;
