"use client";

import { useState, useRef, useCallback } from "react";
import {
  executeWorkflow,
  streamExecution,
  SSEEvent,
  RANDOM_ORGN_NAMES,
  RANDOM_ORGN_CODES,
} from "@/lib/api";

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || "1768";

interface LogEntry {
  time: string;
  type: "info" | "block" | "success" | "error";
  message: string;
}

function pickRandom() {
  const idx = Math.floor(Math.random() * RANDOM_ORGN_NAMES.length);
  const suffix = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return { name: RANDOM_ORGN_NAMES[idx], code: RANDOM_ORGN_CODES[idx] + suffix };
}

export default function Home() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [resultOrgnCd, setResultOrgnCd] = useState<string | null>(null);
  const [resultOrgnNm, setResultOrgnNm] = useState<string | null>(null);
  const [resultOrgnMgmtCd, setResultOrgnMgmtCd] = useState<number | null>(null);
  const [insertCount, setInsertCount] = useState<number | null>(null);
  const [histInsertCount, setHistInsertCount] = useState<number | null>(null);
  const [executionPath, setExecutionPath] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [totalBlocks, setTotalBlocks] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [randomOrg, setRandomOrg] = useState(pickRandom);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    const time = new Date().toLocaleTimeString("ko-KR", {
      hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    setLogs((prev) => [...prev, { time, type, message }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const clearResults = useCallback(() => {
    setResultOrgnCd(null);
    setResultOrgnNm(null);
    setResultOrgnMgmtCd(null);
    setInsertCount(null);
    setHistInsertCount(null);
    setExecutionPath("");
    setDuration(null);
    setTotalBlocks(null);
  }, []);

  const handleRegister = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    clearResults();
    setLogs([]);

    const { name, code } = randomOrg;
    const inputVariables: Record<string, string> = {
      orgnCd: code,
      orgnNm: name,
      uprOrgnMgmtCd: "ROOT",
      orgnPath: `/ROOT/${code}`,
    };

    addLog("info", `[조직 등록] ${name} (${code})`);

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
            addLog("success", `✓ ${event.blockName} — ${event.executionTimeMs}ms`);
          }
          if (event.eventType === "BLOCK_EXECUTION_ERROR") {
            addLog("error", `✗ ${event.blockName}: ${event.errorMessage}`);
          }
          if (event.eventType === "BUSINESS_EXECUTION_COMPLETED") {
            const vars = event.finalVariables;
            if (vars) {
              if (vars.orgnCd != null) setResultOrgnCd(String(vars.orgnCd));
              if (vars.orgnNm != null) setResultOrgnNm(String(vars.orgnNm));
              if (vars.orgnMgmtCd != null)
                setResultOrgnMgmtCd(vars.orgnMgmtCd[0]?.ORGNMGMTCD ?? null);
              if (vars.insertOrgnResult != null)
                setInsertCount(vars.insertOrgnResult[0]?.affected_rows ?? 0);
              if (vars.insertOrgnHistResult != null)
                setHistInsertCount(vars.insertOrgnHistResult[0]?.affected_rows ?? 0);
            }
            setExecutionPath(event.executedBlocksSummary || "");
            setDuration(event.durationMillis || null);
            setTotalBlocks(event.totalBlocksExecuted || null);
            addLog("success", `완료! ${event.totalBlocksExecuted}개 블록, ${event.durationMillis}ms`);
          }
          if (event.eventType === "BUSINESS_EXECUTION_ERROR") {
            addLog("error", `실행 실패: ${event.errorMessage}`);
          }
        },
        () => setLoading(false)
      );
    } catch (err) {
      addLog("error", `오류: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }

    setRandomOrg(pickRandom());
  }, [loading, randomOrg, addLog, clearResults]);

  const handleDupTest = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    clearResults();
    setLogs([]);

    addLog("info", `[중복 테스트] ALPASS (기존 조직코드)`);

    try {
      const executionId = await executeWorkflow(BUSINESS_ID, {
        orgnCd: "ALPASS",
        orgnNm: "중복테스트",
        uprOrgnMgmtCd: "ROOT",
        orgnPath: "/ROOT/DUP",
      });
      addLog("info", `실행 ID: ${executionId.slice(0, 8)}...`);

      streamExecution(
        executionId,
        (event: SSEEvent) => {
          if (event.eventType === "BLOCK_EXECUTION_STARTED" && event.blockName)
            addLog("block", `▶ ${event.blockName} (${event.blockType})`);
          if (event.eventType === "BLOCK_EXECUTION_COMPLETED" && event.blockName)
            addLog("success", `✓ ${event.blockName} — ${event.executionTimeMs}ms`);
          if (event.eventType === "BUSINESS_EXECUTION_COMPLETED") {
            setExecutionPath(event.executedBlocksSummary || "");
            setDuration(event.durationMillis || null);
            setTotalBlocks(event.totalBlocksExecuted || null);
            addLog("info", `중복 감지로 등록 차단됨 (${event.totalBlocksExecuted}개 블록, ${event.durationMillis}ms)`);
          }
        },
        () => setLoading(false)
      );
    } catch (err) {
      addLog("error", `오류: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  }, [loading, addLog, clearResults]);

  const handleInvalidParent = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    clearResults();
    setLogs([]);

    addLog("info", `[상위조직 검증] INVALID_PARENT (없는 상위코드)`);

    try {
      const executionId = await executeWorkflow(BUSINESS_ID, {
        orgnCd: "VALID01",
        orgnNm: "상위조직검증",
        uprOrgnMgmtCd: "INVALID_PARENT",
        orgnPath: "/INVALID",
      });
      addLog("info", `실행 ID: ${executionId.slice(0, 8)}...`);

      streamExecution(
        executionId,
        (event: SSEEvent) => {
          if (event.eventType === "BLOCK_EXECUTION_STARTED" && event.blockName)
            addLog("block", `▶ ${event.blockName} (${event.blockType})`);
          if (event.eventType === "BLOCK_EXECUTION_COMPLETED" && event.blockName)
            addLog("success", `✓ ${event.blockName} — ${event.executionTimeMs}ms`);
          if (event.eventType === "BUSINESS_EXECUTION_COMPLETED") {
            setExecutionPath(event.executedBlocksSummary || "");
            setDuration(event.durationMillis || null);
            setTotalBlocks(event.totalBlocksExecuted || null);
            addLog("info", `상위조직 미존재로 등록 차단됨 (${event.totalBlocksExecuted}개 블록, ${event.durationMillis}ms)`);
          }
        },
        () => setLoading(false)
      );
    } catch (err) {
      addLog("error", `오류: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  }, [loading, addLog, clearResults]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-blue-400">
          알패스 통합업무시스템 — 고객사 조직 등록
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Workflow #{BUSINESS_ID} | POST /pot/pm/cstm/insertCstmOrgn | Oracle DB
        </p>
      </header>

      {/* Action Buttons */}
      <div className="flex justify-center gap-3 mb-6 flex-wrap">
        <button
          onClick={handleRegister}
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded font-medium transition"
        >
          {loading ? "실행 중..." : `조직 등록 (${randomOrg.name})`}
        </button>
        <button
          onClick={handleDupTest}
          disabled={loading}
          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 rounded font-medium transition"
        >
          중복 코드 테스트
        </button>
        <button
          onClick={handleInvalidParent}
          disabled={loading}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded font-medium transition"
        >
          잘못된 상위조직 테스트
        </button>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
        {/* Column 1: Execution Log */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
            <h2 className="font-semibold text-blue-400">실행 로그</h2>
            {duration != null && (
              <span className="text-xs text-emerald-400">{totalBlocks}블록 / {duration}ms</span>
            )}
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[520px] font-mono text-xs space-y-1">
            {logs.map((log, i) => (
              <div key={i} className={
                log.type === "error" ? "text-red-400" :
                log.type === "success" ? "text-green-400" :
                log.type === "block" ? "text-yellow-300" : "text-gray-400"
              }>
                <span className="text-gray-600">{log.time}</span> {log.message}
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-gray-600 italic">버튼을 클릭하여 워크플로우를 실행하세요</p>
            )}
            <div ref={logEndRef} />
          </div>
          {executionPath && (
            <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-500 break-all">
              <span className="text-gray-600">경로:</span> {executionPath}
            </div>
          )}
        </div>

        {/* Column 2: Execution Result */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-emerald-400">실행 결과</h2>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[520px]">
            {insertCount != null && (
              <div className="space-y-3">
                <div className="p-3 bg-green-900/30 border border-green-800 rounded">
                  <div className="text-green-400 font-medium mb-2">조직 등록 성공</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-400">관리코드</div>
                    <div className="font-mono text-blue-300">{resultOrgnMgmtCd}</div>
                    <div className="text-gray-400">조직코드</div>
                    <div className="font-mono">{resultOrgnCd}</div>
                    <div className="text-gray-400">조직명</div>
                    <div>{resultOrgnNm}</div>
                    <div className="text-gray-400">INSERT</div>
                    <div className="text-green-400">{insertCount}건</div>
                    <div className="text-gray-400">이력 INSERT</div>
                    <div className="text-green-400">{histInsertCount}건</div>
                  </div>
                </div>
              </div>
            )}
            {insertCount == null && executionPath && !executionPath.includes("DB(조직정보등록)") && (
              <div className="p-3 bg-amber-900/30 border border-amber-800 rounded">
                <div className="text-amber-400 font-medium">등록 차단됨</div>
                <p className="text-sm text-gray-400 mt-1">
                  {executionPath.includes("조직코드중복") && !executionPath.includes("상위조직")
                    ? "조직코드가 이미 존재합니다 (중복 검증 실패)"
                    : executionPath.includes("상위조직") && !executionPath.includes("조직관리코드생성")
                    ? "상위 조직이 존재하지 않습니다 (상위조직 검증 실패)"
                    : "검증 조건에 의해 등록이 차단되었습니다"}
                </p>
              </div>
            )}
            {insertCount == null && !executionPath && (
              <p className="text-gray-600 italic text-sm">실행 결과가 여기에 표시됩니다</p>
            )}
          </div>
        </div>

        {/* Column 3: Mock UI */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-purple-400">실제 화면 예시</h2>
          </div>
          <div className="p-2 flex-1">
            <div className="bg-white rounded-lg overflow-hidden border border-gray-300 shadow-lg">
              {/* Browser Bar */}
              <div className="bg-gray-200 px-3 py-2 flex items-center gap-2 border-b border-gray-300">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white rounded px-3 py-0.5 text-xs text-gray-500 font-mono">
                  https://alpass.go.kr/pot/pm/cstm/insertCstmOrgn
                </div>
              </div>
              {/* eGov Style Form */}
              <div className="p-4 text-gray-800">
                <div className="border-b-2 border-blue-800 pb-2 mb-4">
                  <h3 className="text-base font-bold text-blue-900">고객사 조직 등록</h3>
                </div>
                <table className="w-full text-xs border-collapse mb-4">
                  <tbody>
                    <tr>
                      <th className="border border-gray-300 bg-blue-50 px-3 py-2 text-left w-28">조직코드</th>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{randomOrg.code}</span>
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-blue-50 px-3 py-2 text-left">조직명</th>
                      <td className="border border-gray-300 px-3 py-2">{randomOrg.name}</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-blue-50 px-3 py-2 text-left">조직유형</th>
                      <td className="border border-gray-300 px-3 py-2">DEPT (부서)</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-blue-50 px-3 py-2 text-left">상위조직</th>
                      <td className="border border-gray-300 px-3 py-2">ROOT (ALPASS HEADQUARTERS)</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-blue-50 px-3 py-2 text-left">지역코드</th>
                      <td className="border border-gray-300 px-3 py-2">KR</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-blue-50 px-3 py-2 text-left">상태</th>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px]">Active</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                {resultOrgnMgmtCd != null && (
                  <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                    등록 완료 — 관리코드: <span className="font-mono font-bold">{resultOrgnMgmtCd}</span>
                  </div>
                )}
                <div className="flex justify-center gap-2">
                  <button
                    onClick={handleRegister}
                    disabled={loading}
                    className="px-4 py-1.5 bg-blue-800 text-white rounded text-xs hover:bg-blue-900 disabled:bg-gray-400"
                  >
                    등록
                  </button>
                  <button
                    onClick={handleDupTest}
                    disabled={loading}
                    className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 disabled:bg-gray-400"
                  >
                    중복 테스트
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center mt-8 text-xs text-gray-600">
        Powered by Greedy Workflow Engine | Oracle 11g XE | 알패스 Business #{BUSINESS_ID}
      </footer>
    </div>
  );
}
