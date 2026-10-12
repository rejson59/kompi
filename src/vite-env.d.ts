/// <reference types="vite/client" />

declare module 'JSCPP' {
  interface JSCPPConfig {
    stdio?: { write?: (s: string) => void; drain?: () => string };
    maxTimeout?: number;
    unsigned_overflow?: 'error' | 'warn' | 'ignore';
    includes?: Record<string, unknown>;
  }
  const JSCPP: {
    run: (code: string, input: string, config?: JSCPPConfig) => number;
    includes: Record<string, unknown>;
  };
  export default JSCPP;
}
