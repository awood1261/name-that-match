import type { Answer } from '../../../shared/src/game/contracts';

/** Bounded filming copy; the frozen answer and private host copy are never mutated. */
function excerpt(value: string, limit: number): string {
  const text = Array.from(value.replace(/\s+/gu, ' ').trim());
  return text.length <= limit ? text.join('') : text.slice(0, limit - 1).join('') + '…';
}
export function stageAnswer(answer: Answer): Answer {
  return { ...answer, participantDescription: excerpt(answer.participantDescription, 120),
    promotion: excerpt(answer.promotion, 64), event: excerpt(answer.event, 64),
    stipulation: answer.stipulation ? excerpt(answer.stipulation, 80) : null,
    championshipInfo: answer.championshipInfo ? excerpt(answer.championshipInfo, 80) : null };
}
