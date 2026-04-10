export interface ExecutionResult {
  orgnMgmtCd: { ORGNMGMTCD: number }[] | null;
  orgnCd: string | null;
  orgnNm: string | null;
  insertOrgnResult: { affected_rows: number }[] | null;
  insertOrgnHistResult: { affected_rows: number }[] | null;
  orgnCdDupCount: { ORGNCDDUPCOUNT: number }[] | null;
  parentOrgnCnt: { PARENTORGNCNT: number }[] | null;
}

export interface SSEEvent {
  eventType: string;
  blockName?: string;
  blockType?: string;
  nodeId?: string;
  executionStatus?: string;
  executionTimeMs?: number;
  executedBlocksSummary?: string;
  durationMillis?: number;
  finalVariables?: ExecutionResult;
  totalBlocksExecuted?: number;
  errorMessage?: string;
}

export async function executeWorkflow(
  businessId: string,
  inputVariables: Record<string, string>
): Promise<string> {
  const res = await fetch(`/api/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, inputVariables }),
  });
  const data = await res.json();
  if (data.code !== "1000") throw new Error(data.message);
  return data.data.executionId;
}

export function streamExecution(
  executionId: string,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void
): () => void {
  const evtSource = new EventSource(`/api/stream/${executionId}`);

  evtSource.addEventListener("business-execution-event", (e) => {
    const data: SSEEvent = JSON.parse(e.data);
    onEvent(data);
    if (
      data.eventType === "BUSINESS_EXECUTION_COMPLETED" ||
      data.eventType === "BUSINESS_EXECUTION_FAILED" ||
      data.eventType === "BUSINESS_EXECUTION_ERROR"
    ) {
      evtSource.close();
      onDone();
    }
  });

  evtSource.onerror = () => {
    evtSource.close();
    onDone();
  };

  return () => evtSource.close();
}

export const RANDOM_ORGN_NAMES = [
  "경영지원팀",
  "법률검토과",
  "감사지원실",
  "정보보안팀",
  "인사관리과",
  "재정운영팀",
  "민원처리반",
  "시설관리과",
  "전산운영팀",
  "대외협력실",
];

export const RANDOM_ORGN_CODES = [
  "MGMT", "LREV", "AUDS", "ISEC", "HRMG",
  "FINC", "CVAF", "FMGT", "ITOP", "EXTC",
];
