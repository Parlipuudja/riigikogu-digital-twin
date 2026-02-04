"use client";

import { useState, useEffect, useRef } from "react";

interface LiveTerminalProps {
  serverUrl: string;
}

export function LiveTerminal({ serverUrl }: LiveTerminalProps) {
  const [output, setOutput] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "running" | "complete" | "error">("idle");
  const [pmRunning, setPmRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Check if PM is already running
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [serverUrl]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const checkStatus = async () => {
    try {
      const res = await fetch(`${serverUrl}/health`);
      if (res.ok) {
        const data = await res.json();
        setPmRunning(data.pmRunning);
        if (data.pmRunning && status === "idle") {
          // Auto-join existing stream
          joinStream();
        }
      }
    } catch (e) {
      // Server not reachable
    }
  };

  const joinStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus("connecting");
    const es = new EventSource(`${serverUrl}/stream/project-manager`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus("running");
    };

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      setOutput((prev) => [...prev, `[STATUS] ${data.message}`]);
    });

    es.addEventListener("output", (e) => {
      const data = JSON.parse(e.data);
      setOutput((prev) => [...prev, data.text]);
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setOutput((prev) => [...prev, `\n[COMPLETE] Exit code: ${data.code}, Status: ${data.status}`]);
      setStatus("complete");
      setPmRunning(false);
      es.close();
    });

    es.addEventListener("error", (e) => {
      setStatus("error");
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setStatus("idle");
        setPmRunning(false);
      }
    };
  };

  const triggerPM = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setOutput([]);
    setStatus("connecting");

    const es = new EventSource(`${serverUrl}/trigger/project-manager`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus("running");
      setPmRunning(true);
    };

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      setOutput((prev) => [...prev, `[STATUS] ${data.message}`]);
    });

    es.addEventListener("output", (e) => {
      const data = JSON.parse(e.data);
      const prefix = data.stderr ? "[STDERR] " : "";
      setOutput((prev) => [...prev, prefix + data.text]);
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setOutput((prev) => [...prev, `\n[COMPLETE] Exit code: ${data.code}, Status: ${data.status}`]);
      setStatus("complete");
      setPmRunning(false);
      es.close();
    });

    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse((e as any).data);
        setOutput((prev) => [...prev, `[ERROR] ${data.message}`]);
      } catch {
        setOutput((prev) => [...prev, `[ERROR] Connection error`]);
      }
      setStatus("error");
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        if (status === "connecting") {
          setStatus("error");
          setOutput((prev) => [...prev, "[ERROR] Failed to connect to operative server"]);
        }
      }
    };
  };

  const stopPM = async () => {
    try {
      await fetch(`${serverUrl}/stop/project-manager`, { method: "POST" });
      setOutput((prev) => [...prev, "\n[STOPPED] Stop signal sent"]);
    } catch (e) {
      setOutput((prev) => [...prev, "\n[ERROR] Failed to send stop signal"]);
    }
  };

  const clearOutput = () => {
    setOutput([]);
    setStatus("idle");
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={triggerPM}
          disabled={status === "running" || status === "connecting"}
          className="btn-primary"
        >
          {status === "connecting" ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⟳</span> Connecting...
            </span>
          ) : status === "running" ? (
            <span className="flex items-center gap-2">
              <span className="animate-pulse">●</span> Running...
            </span>
          ) : (
            "▶ Run Project Manager"
          )}
        </button>

        {status === "running" && (
          <button onClick={stopPM} className="btn-secondary text-vote-against">
            ■ Stop
          </button>
        )}

        <button onClick={clearOutput} className="btn-secondary">
          Clear
        </button>

        <div className="ml-auto text-sm">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
              status === "running"
                ? "bg-conf-high/10 text-conf-high"
                : status === "error"
                ? "bg-vote-against/10 text-vote-against"
                : status === "complete"
                ? "bg-rk-500/10 text-rk-600"
                : "bg-ink-100 text-ink-500"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status === "running"
                  ? "bg-conf-high animate-pulse"
                  : status === "error"
                  ? "bg-vote-against"
                  : status === "complete"
                  ? "bg-rk-500"
                  : "bg-ink-300"
              }`}
            />
            {status === "idle" && "Idle"}
            {status === "connecting" && "Connecting"}
            {status === "running" && "Running"}
            {status === "complete" && "Complete"}
            {status === "error" && "Error"}
          </span>
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={outputRef}
        className="bg-ink-900 text-ink-100 font-mono text-sm p-4 rounded-lg h-[500px] overflow-auto"
      >
        {output.length === 0 ? (
          <div className="text-ink-500">
            Click "Run Project Manager" to start...
          </div>
        ) : (
          <pre className="whitespace-pre-wrap">{output.join("")}</pre>
        )}
        {status === "running" && (
          <span className="animate-pulse text-conf-high">▌</span>
        )}
      </div>

      {/* Server Info */}
      <div className="text-xs text-ink-500">
        Server: {serverUrl} | {pmRunning ? "PM Active" : "PM Idle"}
      </div>
    </div>
  );
}
