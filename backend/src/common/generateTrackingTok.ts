import { randomUUID } from 'node:crypto';

export function generarTrackingTok(): string {    
    return randomUUID().replace(/-/g, '').slice(0, 21);
  }