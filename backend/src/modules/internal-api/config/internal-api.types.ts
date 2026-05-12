export interface InternalApiKeyEntry {
    id: string;
    key: string;
    label: string;
    serviceUserId: number;
    scopes?: string[];
}

export interface InternalActor {
    keyId: string;
    label: string;
    serviceUserId: number;
    scopes: string[];
}
