export type CompletionSignal = "controls" | "quiescence";
export type SelectorRole =
  | "inputBox"
  | "sendButton"
  | "stopButton"
  | "latestResponse"
  | "copyButton"
  | "usageLimit";

export type ModelResult =
  | {
      status: "success";
      text: string;
      truncated: boolean;
      completionSignals: CompletionSignal[];
      timings: {
        startedAt: number;
        submittedAt: number;
        completedAt: number;
      };
    }
  | {
      status: "timeout";
      partialText: string;
      timings: {
        startedAt: number;
        submittedAt: number;
        timedOutAt: number;
      };
    }
  | {
      status: "error";
      stage: "inject" | "submit" | "await" | "extract";
      message: string;
    }
  | {
      status: "rate_limited";
      message: string;
    }
  | {
      status: "auth_required";
      message: string;
    };

export interface HealthCheckResult {
  authenticated: boolean;
  selectors: Array<{
    role: SelectorRole;
    matchedSelector: string | null;
    fallbackIndex: number | null;
  }>;
}

export interface ModelTransport {
  readonly id: string;
  healthCheck(): Promise<HealthCheckResult>;
  ask(prompt: string, options: { timeoutMs: number }): Promise<ModelResult>;
}
