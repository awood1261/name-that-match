import type { GameTier } from '../classification.js';
import type { HostIntent, HostSnapshot, Receipt } from './contracts.js';

export interface TierAvailability { screenshots: number; matches: number }
export interface GameAvailability {
  tiers: Record<GameTier, TierAvailability>; distinctMatches: number; asOf: string;
}
export interface ControllerCredential { token: string; serverEpoch: string; generation: number }
export interface HostStatus {
  protocolVersion: 1; serverEpoch: string; sequence: number;
  snapshot: HostSnapshot | null; availability: GameAvailability;
  allowedActions: HostIntent['type'][]; candidateValid: boolean;
  primaryDisplay: { ready: false; message: string }; preparationError: string | null;
}
export interface HostCommandResponse { receipt: Receipt; replayed: boolean; status: HostStatus }
export interface GameApiFailure {
  code: string; message: string; currentRevision?: number; fieldErrors?: Record<string, string>;
}
