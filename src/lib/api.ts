export interface PollItem {
  POLL_ID: string;
  POLL_IEM_ID: string;
  POLL_IEM_NM: string;
  FRST_REGIST_PNTTM: string;
  LAST_UPDT_PNTTM: string;
}

export interface ExecutionResult {
  resultList: PollItem[] | null;
  insertCount: { affected_rows: number }[] | null;
  deleteCount: { affected_rows: number }[] | null;
  updateCount: { affected_rows: number }[] | null;
  pollKindCodeList: unknown[] | null;
  onlinePollItem: unknown | null;
  redirectUrl: string | null;
  paginationInfo: unknown | null;
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
  afterVariables?: Record<string, unknown>;
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
      data.eventType === "BUSINESS_EXECUTION_FAILED"
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

export const RANDOM_POLL_ITEMS = [
  "대기실 청결도",
  "안내데스크 친절도",
  "주차장 접근성",
  "화장실 청결도",
  "엘리베이터 이용 편의성",
  "소음 관리 수준",
  "냉난방 적정성",
  "무선인터넷 품질",
  "식당 메뉴 만족도",
  "보안 시스템 신뢰도",
];
