"use client";

import { useState, useRef, useCallback } from "react";
import {
  executeWorkflow,
  streamExecution,
  SSEEvent,
  PollItem,
  RANDOM_POLL_ITEMS,
} from "@/lib/api";

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || "3162";

interface LogEntry {
  time: string;
  type: "info" | "block" | "success" | "error";
  message: string;
}

export default function Home() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [resultList, setResultList] = useState<PollItem[] | null>(null);
  const [insertCount, setInsertCount] = useState<number | null>(null);
  const [deleteCount, setDeleteCount] = useState<number | null>(null);
  const [executionPath, setExecutionPath] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  const [randomItemName, setRandomItemName] = useState(
    () => RANDOM_POLL_ITEMS[Math.floor(Math.random() * RANDOM_POLL_ITEMS.length)]
  );
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback(
    (type: LogEntry["type"], message: string) => {
      const time = new Date().toLocaleTimeString("ko-KR", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLogs((prev) => [...prev, { time, type, message }]);
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    []
  );

  const clearResults = useCallback(() => {
    setResultList(null);
    setInsertCount(null);
    setDeleteCount(null);
    setExecutionPath("");
    setDuration(null);
  }, []);

  const runAction = useCallback(
    async (action: string, extraVars: Record<string, string> = {}) => {
      if (loading) return;
      setLoading(true);
      clearResults();
      setLogs([]);

      const inputVariables: Record<string, string> = {
        action,
        pollId: "POLL001",
        ...extraVars,
      };

      addLog("info", `[${action.toUpperCase()}] 실행 요청...`);

      try {
        const executionId = await executeWorkflow(BUSINESS_ID, inputVariables);
        addLog("info", `실행 ID: ${executionId.slice(0, 8)}...`);

        streamExecution(
          executionId,
          (event: SSEEvent) => {
            if (event.eventType === "BLOCK_EXECUTION_STARTED" && event.blockName) {
              addLog("block", `▶ ${event.blockName} (${event.blockType})`);
            }
            if (event.eventType === "BLOCK_EXECUTION_COMPLETED" && event.blockName) {
              addLog(
                "success",
                `✓ ${event.blockName} — ${event.executionTimeMs}ms`
              );
            }
            if (event.eventType === "BUSINESS_EXECUTION_COMPLETED") {
              const vars = event.finalVariables;
              if (vars) {
                if (vars.resultList != null) setResultList(vars.resultList);
                if (vars.insertCount != null)
                  setInsertCount(vars.insertCount[0]?.affected_rows ?? 0);
                if (vars.deleteCount != null)
                  setDeleteCount(vars.deleteCount[0]?.affected_rows ?? 0);
              }
              setExecutionPath(event.executedBlocksSummary || "");
              setDuration(event.durationMillis || null);
              addLog(
                "success",
                `완료! ${event.totalBlocksExecuted}개 블록, ${event.durationMillis}ms`
              );
            }
            if (event.eventType === "BUSINESS_EXECUTION_FAILED") {
              addLog("error", "실행 실패!");
            }
          },
          () => setLoading(false)
        );
      } catch (err) {
        addLog("error", `오류: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    },
    [loading, addLog, clearResults]
  );

  const handleList = () => runAction("list");

  const handleCreate = () => {
    const iemId = `IEM${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
    runAction("create", {
      pollIemId: iemId,
      pollIemNm: randomItemName,
    });
    setRandomItemName(
      RANDOM_POLL_ITEMS[Math.floor(Math.random() * RANDOM_POLL_ITEMS.length)]
    );
  };

  const handleDelete = (iemId?: string) => {
    const target = iemId || deleteId.trim();
    if (!target) return;
    const fullId = target.startsWith("IEM") ? target : `IEM${target}`;
    if (!/^IEM\w+$/.test(fullId)) return;
    runAction("delete", { pollIemId: fullId });
    setDeleteId("");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-blue-400">
          알패스 통합업무시스템 — 온라인 설문 항목 관리
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Workflow #{BUSINESS_ID} | CRUD Demo with Real Oracle DB
        </p>
      </header>

      {/* Action Buttons */}
      <div className="flex justify-center gap-3 mb-6 flex-wrap">
        <button
          onClick={handleList}
          disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded font-medium transition"
        >
          {loading ? "실행 중..." : "목록 조회"}
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded font-medium transition"
          title={`등록될 항목: ${randomItemName}`}
        >
          항목 등록 ({randomItemName})
        </button>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-sm">IEM</span>
          <input
            type="text"
            value={deleteId}
            onChange={(e) => setDeleteId(e.target.value)}
            placeholder="ID 번호"
            className="w-20 px-2 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleDelete()}
          />
          <button
            onClick={() => handleDelete()}
            disabled={loading || !deleteId.trim()}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded font-medium transition"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
        {/* Column 1: Execution Log */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
            <h2 className="font-semibold text-blue-400">실행 로그</h2>
            {duration != null && (
              <span className="text-xs text-gray-500">{duration}ms</span>
            )}
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[500px] font-mono text-xs space-y-1">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`${
                  log.type === "error"
                    ? "text-red-400"
                    : log.type === "success"
                    ? "text-green-400"
                    : log.type === "block"
                    ? "text-yellow-300"
                    : "text-gray-400"
                }`}
              >
                <span className="text-gray-600">{log.time}</span> {log.message}
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-gray-600 italic">버튼을 클릭하여 워크플로우를 실행하세요</p>
            )}
            <div ref={logEndRef} />
          </div>
          {executionPath && (
            <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-500">
              <span className="text-gray-600">경로:</span> {executionPath}
            </div>
          )}
        </div>

        {/* Column 2: Execution Result */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-emerald-400">실행 결과</h2>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[500px]">
            {insertCount != null && (
              <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded">
                <span className="text-green-400 font-medium">
                  INSERT 성공: {insertCount}건
                </span>
              </div>
            )}
            {deleteCount != null && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded">
                <span className="text-red-400 font-medium">
                  DELETE 성공: {deleteCount}건
                </span>
              </div>
            )}
            {resultList != null && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="py-2 px-2 text-left">항목 ID</th>
                      <th className="py-2 px-2 text-left">항목명</th>
                      <th className="py-2 px-2 text-left">등록일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultList.map((item) => (
                      <tr
                        key={item.POLL_IEM_ID}
                        className="border-b border-gray-800 hover:bg-gray-800/50"
                      >
                        <td className="py-2 px-2 font-mono text-blue-300 text-xs">
                          {item.POLL_IEM_ID}
                        </td>
                        <td className="py-2 px-2">{item.POLL_IEM_NM}</td>
                        <td className="py-2 px-2 text-xs text-gray-500">
                          {new Date(item.FRST_REGIST_PNTTM).toLocaleDateString("ko-KR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-gray-500">
                  총 {resultList.length}건
                </p>
              </div>
            )}
            {resultList == null && insertCount == null && deleteCount == null && (
              <p className="text-gray-600 italic text-sm">
                실행 결과가 여기에 표시됩니다
              </p>
            )}
          </div>
        </div>

        {/* Column 3: Mock UI */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-purple-400">실제 화면 예시</h2>
          </div>
          <div className="p-2 flex-1">
            {/* Browser Frame */}
            <div className="bg-white rounded-lg overflow-hidden border border-gray-300 shadow-lg">
              {/* Browser Bar */}
              <div className="bg-gray-200 px-3 py-2 flex items-center gap-2 border-b border-gray-300">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white rounded px-3 py-0.5 text-xs text-gray-500 font-mono">
                  https://alpass.go.kr/uss/olp/opm/listOnlinePollItem.do
                </div>
              </div>
              {/* eGov Style Content */}
              <div className="p-4 text-gray-800">
                <div className="border-b-2 border-blue-800 pb-2 mb-4">
                  <h3 className="text-base font-bold text-blue-900">
                    온라인 설문 항목 관리
                  </h3>
                </div>
                {resultList != null ? (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="border border-gray-300 px-2 py-1.5 text-center">
                          No.
                        </th>
                        <th className="border border-gray-300 px-2 py-1.5 text-center">
                          항목ID
                        </th>
                        <th className="border border-gray-300 px-2 py-1.5 text-center">
                          항목명
                        </th>
                        <th className="border border-gray-300 px-2 py-1.5 text-center">
                          관리
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultList.map((item, i) => (
                        <tr key={item.POLL_IEM_ID} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1.5 text-center">
                            {i + 1}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center font-mono">
                            {item.POLL_IEM_ID}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5">
                            {item.POLL_IEM_NM}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">
                            <button
                              onClick={() => handleDelete(item.POLL_IEM_ID)}
                              disabled={loading}
                              className="px-2 py-0.5 bg-red-500 text-white rounded text-[10px] hover:bg-red-600 disabled:bg-gray-400"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    목록 조회 버튼을 클릭하세요
                  </div>
                )}
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    onClick={handleList}
                    disabled={loading}
                    className="px-3 py-1 bg-blue-800 text-white rounded text-xs hover:bg-blue-900 disabled:bg-gray-400"
                  >
                    조회
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="px-3 py-1 bg-green-700 text-white rounded text-xs hover:bg-green-800 disabled:bg-gray-400"
                  >
                    등록
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center mt-8 text-xs text-gray-600">
        Powered by Greedy Workflow Engine | Oracle 11g XE | Business #{BUSINESS_ID}
      </footer>
    </div>
  );
}
