import type { GameTier } from '../classification.js';
import type { Obscurity, PartialDate, VisualDifficulty } from '../library.js';

export const GAME_PROTOCOL_VERSION = 1;
export const GAME_RULES_VERSION = 1;
export const GUESSING_WINDOW_MS = 30_000;
export const MAX_GAME_TURNS = 1000;
export const MAX_GAME_COMMANDS = 10_000;
export interface Contestant { id: string; name: string }
export interface Answer {
  participantDescription: string; promotion: string; event: string;
  matchDate: PartialDate | null; stipulation: string | null; championshipInfo: string | null;
}
/** Frozen server observation; deliberately excludes capture/video provenance and paths. */
export interface RoundContext {
  screenshotId: string; matchId: string; screenshotRevision: number; matchRevision: number;
  image: { sha256: string; width: number; height: number; byteSize: number };
  answer: Answer; obscurity: Obscurity; difficulty: VisualDifficulty; rulesVersion: 1;
}
export type PauseReason = 'host' | 'primary-display' | 'host-connection';
export type VoidReason = 'skip' | 'void' | 'interrupted';
interface Attempt {
  id: string; contestantId: string; ordinal: number; requestedTier: GameTier;
  createdAt: string; timerGeneration: number;
}
interface Prepared extends Attempt { context: RoundContext }
interface Exposed extends Prepared { turnOrdinal: number; exposedAt: string }
export interface Judgment {
  outcome: 'correct' | 'incorrect' | 'timeout' | 'void'; award: 0 | 1 | 2 | 3;
  lateEntry: boolean; voidReason: VoidReason | null; judgedAt: string;
}
export type Round =
  | (Attempt & { phase: 'preparing' })
  | (Prepared & { phase: 'ready' })
  | (Exposed & { phase: 'guessing'; windowMs: number })
  | (Exposed & { phase: 'paused'; remainingMs: number; pauseReason: PauseReason })
  | (Exposed & { phase: 'awaiting_judgment' })
  | (Exposed & { phase: 'interrupted' })
  | (Exposed & Judgment & { phase: 'adjudicated' | 'answer_revealed' })
  | (Attempt & { phase: 'cancelled'; context: RoundContext | null; cancelReason: 'host' | 'preparation-failed' | 'recovery' });
export interface Award { id: string; roundId: string; contestantId: string; points: 1 | 2 | 3; createdAt: string }
interface SessionBase {
  id: string; stateVersion: number; rulesVersion: 1; contestants: Contestant[];
  rounds: Round[]; awards: Award[]; createdAt: string; updatedAt: string;
  nextAttemptOrdinal: number; nextTurnOrdinal: number;
}
export type GameState = SessionBase & (
  | { status: 'setup'; activeContestantId: string; currentRoundId: null }
  | { status: 'active'; activeContestantId: string; currentRoundId: string | null }
  | { status: 'completed'; activeContestantId: string; currentRoundId: string | null; completedAt: string }
  | { status: 'discarded'; activeContestantId: string; currentRoundId: null; completedAt: string }
);
type EmptyCommand = 'START' | 'DISCARD_SETUP' | 'REVEAL_AND_START' | 'CORRECT' | 'INCORRECT' |
  'CORRECT_BEFORE_BUZZER' | 'CONFIRM_TIMEOUT' | 'PAUSE' | 'RESUME' | 'CANCEL_UNEXPOSED' |
  'VOID_INTERRUPTED' | 'REVEAL_ANSWER' | 'ADVANCE' | 'END_GAME';
export type HostIntent =
  | { [K in EmptyCommand]: { type: K } }[EmptyCommand]
  | { type: 'CONFIGURE_SETUP'; contestants: Contestant[]; activeContestantId: string }
  | { type: 'SELECT_CONTESTANT'; contestantId: string }
  | { type: 'PREPARE'; roundId: string; tier: GameTier }
  | { type: 'VOID_EXPOSED'; reason: 'skip' | 'void' };
interface CommandBase {
  protocolVersion: 1; commandId: string; sessionId: string;
  expectedStateVersion: number; roundId?: string;
}
export type CommandEnvelope = { [I in HostIntent as I['type']]: CommandBase & {
  type: I['type']; payload: Omit<I, 'type'>;
} }[HostIntent['type']];
export interface CreateGame {
  protocolVersion: 1; commandId: string; sessionId: string;
  contestants: Contestant[]; activeContestantId: string;
}
export type InternalIntent =
  | { type: 'PREPARE_SUCCEEDED'; context: RoundContext }
  | { type: 'PREPARE_FAILED' }
  | { type: 'EXPIRE'; timerGeneration: number }
  | { type: 'CONNECTION_LOST'; reason: Exclude<PauseReason, 'host'> }
  | { type: 'RECOVER_RUNNING' | 'RECOVER_PREPARING' | 'INTERRUPT_IMAGE' };
/** Runtime-only, never reconstructed from a previous process's clock. */
export interface RunningClock { roundId: string; timerGeneration: number; startedAtMonoMs: number; deadlineMonoMs: number }
export interface TransitionContext {
  nowIso: string; nowMonoMs: number; clock: RunningClock | null;
  hasEligibleMatches: boolean; primaryReady: boolean; candidateCurrent: boolean; awardId: string;
}
export interface Receipt { commandId: string; sessionId: string; roundId: string | null; acceptedVersion: number }
export interface CommandResult { receipt: Receipt; replayed: boolean; state: GameState }
export interface ScoreRow {
  contestantId: string; name: string; total: number;
  lastOutcome?: { outcome: Judgment['outcome']; award: number; turnOrdinal: number };
}
interface PublicBase {
  protocolVersion: 1; sessionId: string; stateVersion: number; activeContestantId: string;
  contestants: Contestant[]; scores: ScoreRow[]; turnsExposed: number;
}
interface PublicRound { roundId: string; contestantId: string; requestedTier: GameTier; turnOrdinal: number | null }
export type DisplaySnapshot = PublicBase & (
  | { phase: 'setup' | 'between_rounds' | 'discarded' }
  | { phase: 'completed'; winnerIds: string[] }
  | (PublicRound & { phase: 'preparing' })
  | (PublicRound & { phase: 'ready'; imageKey: string })
  | (PublicRound & { phase: 'guessing'; imageKey: string; remainingMs: number })
  | (PublicRound & { phase: 'paused' | 'awaiting_judgment' | 'interrupted'; remainingMs: number })
  | (PublicRound & { phase: 'adjudicated' })
  | (PublicRound & { phase: 'answer_revealed'; outcome: Judgment['outcome']; award: number; answer: Answer })
);
export interface HostSnapshot {
  protocolVersion: 1; role: 'host'; session: Omit<GameState, 'rounds' | 'awards'>;
  currentRound: Round | null; recentRounds: Round[]; historyTruncated: boolean; scores: ScoreRow[];
  winnerIds?: string[];
}
