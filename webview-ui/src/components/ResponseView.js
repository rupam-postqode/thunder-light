import React, { useState, useEffect } from "react";

function ResponseView({ response, error }) {
  const [statusLine, setStatusLine] = useState("");
  const [headers, setHeaders] = useState({});
  const [body, setBody] = useState("");
  const [contentType, setContentType] = useState("");

  useEffect(() => {
    if (error) {
      setStatusLine("Error");
      setHeaders({});
      setBody(error);
      return;
    }

    if (!response) {
      setStatusLine("");
      setHeaders({});
      setBody("Response will appear here...");
      return;
    }

    // Split response into status + headers + body
    const [statusAndHeaders, ...bodyParts] = response.split("\n\n");
    const [statusLineRaw, ...headerLines] = statusAndHeaders.split("\n");

    const headerMap = {};
    headerLines.forEach((line) => {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length) {
        headerMap[key.trim()] = valueParts.join(":").trim();
      }
    });

    const contentType = headerMap["content-type"] || "";
    setContentType(contentType);
    setStatusLine(statusLineRaw);
    setHeaders(headerMap);

    const bodyRaw = bodyParts.join("\n\n").trim();

    try {
      if (contentType.includes("application/json")) {
        const json = JSON.parse(bodyRaw);
        setBody(JSON.stringify(json, null, 2));
      } else {
        setBody(bodyRaw);
      }
    } catch {
      setBody(bodyRaw);
    }
  }, [response, error]);

  return (
    <div className="response-container">
      <div className="status-bar">
        <strong>{statusLine}</strong>
      </div>

      {Object.keys(headers).length > 0 && (
        <div className="headers-section">
          <h4>Headers</h4>
          <pre className="headers-content">
            {Object.entries(headers)
              .map(([key, value]) => `${key}: ${value}`)
              .join("\n")}
          </pre>
        </div>
      )}

      <div className="body-section">
        <h4>Body</h4>
        <pre className="response-content">{body}</pre>
      </div>
    </div>
  );
}

export default ResponseView;
