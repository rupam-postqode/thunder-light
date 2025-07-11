import React, { useState, useEffect } from "react";

function ResponseView({ response, error }) {
  const [formattedResponse, setFormattedResponse] = useState("");

  useEffect(() => {
    if (error) {
      setFormattedResponse(`Error: ${error}`);
      return;
    }

    if (!response) {
      setFormattedResponse("Response will appear here...");
      return;
    }

    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response);
      setFormattedResponse(JSON.stringify(parsed, null, 2));
    } catch {
      // If not JSON, use as-is
      setFormattedResponse(response);
    }
  }, [response, error]);

  return (
    <div className="response-container">
      <div className="status-bar">Response</div>
      <pre className="response-content">{formattedResponse}</pre>
    </div>
  );
}

export default ResponseView;
