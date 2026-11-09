import type { GameTier } from '../classification.js';
import type { HostIntent, HostSnapshot, Receipt } from './contracts.js';
import type { PrimaryDisplayStatus } from './display.js';

export interface TierAvailability { screenshots: number; matches: number }
export interface GameAvailability {
  tiers: Record<GameTier, TierAvailability>; distinctMatches: number; asOf: string;
}
export interface ControllerCredential { token: string; serverEpoch: string; generation: number }
export interface HostStatus {
  protocolVersion: 1; serverEpoch: string; sequence: number;
  snapshot: HostSnapshot | null; availability: GameAvailability;
  allowedActions: HostIntent['type'][]; candidateValid: boolean;
  primaryDisplay: PrimaryDisplayStatus; preparationError: string | null;
  timing?: { serverMonoMs: number; remainingMs: number } | null;
}
export interface HostCommandResponse { receipt: Receipt; replayed: boolean; status: HostStatus }
export interface GameApiFailure {
  code: string; message: string; currentRevision?: number; fieldErrors?: Record<string, string>;
}
