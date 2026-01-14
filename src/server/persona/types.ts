/**
 * Persona 관련 타입 정의
 * 원본: src/ts/persona.ts
 */

export interface PersonaCard {
    name: string;
    personaPrompt: string;
    note?: string;
}

export interface PersonaImageResult {
    imageData: Uint8Array;
    fileName: string;
}

export interface PersonaImportResult {
    success: boolean;
    persona?: PersonaCard;
    imageData?: Uint8Array;
    error?: string;
}
