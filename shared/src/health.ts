export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.status === 'ok' &&
    typeof candidate.service === 'string' &&
    candidate.service.length > 0 &&
    typeof candidate.timestamp === 'string' &&
    candidate.timestamp.length > 0
  );
}
