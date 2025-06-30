// src/utils/auth-path.util.ts
import * as path from 'path';
import * as fs from 'fs';

const isDocker = fs.existsSync('/.dockerenv');

const BASE_AUTH_PATH = isDocker
    ? '/app/.wwebjs_auth' // en Docker, es donde montás el volumen
    : path.resolve(__dirname, '..', '..', '.wwebjs_auth'); // local

export function getSessionFolder(sessionId: string): string {
    return path.join(BASE_AUTH_PATH, `session-${sessionId}`);
}

export function getAuthBasePath(): string {
    return BASE_AUTH_PATH;
}