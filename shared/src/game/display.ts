import type { DisplaySnapshot } from './contracts.js';

export interface DisplayCredential { token: string; serverEpoch: string; displayId: string }
export interface ClockSample { nonce: string; serverMonoMs: number }
export interface DisplayObservation {
  protocolVersion: 1; serverEpoch: string; sequence: number; connectionSequence: number;
  snapshot: DisplaySnapshot; sample: ClockSample;
  asset: { roundId: string; imageKey: string } | null;
}
export interface DisplayStatus {
  displayId: string; primary: boolean; connected: boolean; ready: boolean;
}
export interface PrimaryDisplayStatus {
  ready: boolean; message: string; displayId?: string; displays?: DisplayStatus[];
}
export type DisplayReport =
  | { type: 'connect'; connectionId: string }
  | { type: 'status'; connectionId: string; connectionSequence: number;
      roundId: string | null; imageKey: string | null; decoded: boolean;
      clock: { nonce: string; rttMs: number } | null };
