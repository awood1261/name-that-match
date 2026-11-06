export function isHealthResponse(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value;
    return (candidate.status === 'ok' &&
        typeof candidate.service === 'string' &&
        candidate.service.length > 0 &&
        typeof candidate.timestamp === 'string' &&
        candidate.timestamp.length > 0);
}
//# sourceMappingURL=health.js.map