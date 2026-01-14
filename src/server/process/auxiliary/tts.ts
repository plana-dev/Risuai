/**
 * TTS (Text-to-Speech) 서버 사이드 지원
 * 
 * 설계 방안:
 * 1. 서버에서 오디오 생성 후 클라이언트로 전송
 * 2. 클라이언트에서 직접 처리 (기존 방식 유지)
 * 3. 하이브리드: 서버에서 처리 가능한 것은 서버에서, 불가능한 것은 클라이언트에서
 * 
 * 현재 구현: 서버에서 처리 가능한 TTS만 구현 (ElevenLabs, VOICEVOX 등)
 * 클라이언트 전용 TTS (Web Speech API)는 클라이언트에서 처리
 */

import type { character, Database } from '../../database';
import type { TTSGenerationResult } from './types';

/**
 * TTS 생성 (서버 사이드)
 */
export async function generateTTS(
    character: character,
    text: string,
    database: Database
): Promise<TTSGenerationResult> {
    if (!text) {
        return {
            success: false,
            error: 'Text is required',
        };
    }

    // 따옴표만 읽기 옵션
    if (character.ttsReadOnlyQuoted) {
        const matches = text.match(/["「](.*?)["」]/g);
        if (matches && matches.length > 0) {
            text = matches.map(match => match.slice(1, -1)).join('');
        } else {
            text = '';
        }
    }

    if (!text) {
        return {
            success: false,
            error: 'No text to speak',
        };
    }

    text = text.replace(/\*/g, '');

    switch (character.ttsMode) {
        case 'elevenlab': {
            return await generateElevenLabsTTS(text, character, database);
        }
        case 'VOICEVOX': {
            return await generateVoiceVoxTTS(text, character, database);
        }
        case 'webspeech': {
            // Web Speech API는 클라이언트 전용
            return {
                success: false,
                error: 'Web Speech API is client-side only. Please use client-side TTS.',
            };
        }
        case 'vits': {
            // VITS는 서버에서 처리 가능 (transformers 사용)
            return await generateVITSTTS(text, character, database);
        }
        default: {
            return {
                success: false,
                error: `Unsupported TTS mode: ${character.ttsMode}`,
            };
        }
    }
}

/**
 * ElevenLabs TTS
 */
async function generateElevenLabsTTS(
    text: string,
    character: character,
    database: Database
): Promise<TTSGenerationResult> {
    if (!database.elevenLabKey) {
        return {
            success: false,
            error: 'ElevenLabs API key is not configured',
        };
    }

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${character.ttsSpeech}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': database.elevenLabKey,
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                error: `ElevenLabs API error: ${errorText}`,
            };
        }

        const audioBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(audioBuffer).toString('base64');

        return {
            success: true,
            audioData: `data:audio/mpeg;base64,${base64}`,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * VOICEVOX TTS
 */
async function generateVoiceVoxTTS(
    text: string,
    character: character,
    database: Database
): Promise<TTSGenerationResult> {
    if (!database.voicevoxUrl) {
        return {
            success: false,
            error: 'VOICEVOX URL is not configured',
        };
    }

    try {
        // 일본어로 번역 (필요한 경우)
        const jpText = await translateVox(text, database);

        // Audio Query 생성
        const queryResponse = await fetch(
            `${database.voicevoxUrl}/audio_query?text=${encodeURIComponent(jpText)}&speaker=${character.ttsSpeech}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!queryResponse.ok) {
            return {
                success: false,
                error: `VOICEVOX query error: ${queryResponse.statusText}`,
            };
        }

        const queryJson = await queryResponse.json();
        const bodyData = {
            accent_phrases: queryJson.accent_phrases,
            speedScale: character.voicevoxConfig?.SPEED_SCALE || 1.0,
            pitchScale: character.voicevoxConfig?.PITCH_SCALE || 0.0,
            volumeScale: character.voicevoxConfig?.VOLUME_SCALE || 1.0,
            intonationScale: character.voicevoxConfig?.INTONATION_SCALE || 1.0,
            prePhonemeLength: queryJson.prePhonemeLength,
            postPhonemeLength: queryJson.postPhonemeLength,
            outputSamplingRate: queryJson.outputSamplingRate,
            outputStereo: queryJson.outputStereo,
            kana: queryJson.kana,
        };

        // Synthesis
        const synthesisResponse = await fetch(
            `${database.voicevoxUrl}/synthesis?speaker=${character.ttsSpeech}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bodyData),
            }
        );

        if (!synthesisResponse.ok) {
            return {
                success: false,
                error: `VOICEVOX synthesis error: ${synthesisResponse.statusText}`,
            };
        }

        const audioBuffer = await synthesisResponse.arrayBuffer();
        const base64 = Buffer.from(audioBuffer).toString('base64');

        return {
            success: true,
            audioData: `data:audio/wav;base64,${base64}`,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * VITS TTS (서버 사이드)
 * @huggingface/transformers를 사용하여 서버 사이드에서 VITS TTS 생성
 */
async function generateVITSTTS(
    text: string,
    character: character,
    database: Database
): Promise<TTSGenerationResult> {
    if (!character.vits) {
        return {
            success: false,
            error: 'VITS model is not configured',
        };
    }

    try {
        // @huggingface/transformers를 사용하여 TTS 생성
        // Note: 서버 사이드에서는 transformers.js를 사용해야 함
        const { pipeline } = await import('@huggingface/transformers');
        const { WaveFile } = await import('wavefile');

        const modelData = character.vits;
        const modelId = typeof modelData === 'string' ? modelData : modelData.id;

        // Pipeline 생성 (캐싱 고려)
        // TODO: Pipeline 인스턴스를 캐싱하여 재사용
        const synthesizer = await pipeline('text-to-speech', modelId);

        // TTS 생성
        const output = await synthesizer(text, {});

        // WAV 파일 생성
        const wav = new WaveFile();
        wav.fromScratch(1, output.sampling_rate, '32f', output.audio);
        const wavBuffer = wav.toBuffer();

        // Base64로 변환
        const base64 = Buffer.from(wavBuffer).toString('base64');

        return {
            success: true,
            audioData: `data:audio/wav;base64,${base64}`,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * translateVox: 영어를 일본어로 번역 (VOICEVOX용)
 * 원본: src/ts/translator/translator.ts의 translateVox
 */
async function translateVox(text: string, database: Database): Promise<string> {
    if (!text || text.trim().length === 0) {
        return text;
    }

    // 간단한 Google Translate API 호출
    // TODO: 데이터베이스 설정에 따라 다른 번역 서비스 사용 (DeepL, LLM 등)
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=en&tl=ja&q=${encodeURIComponent(text)}`;
        const response = await fetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            console.warn('[TTS] Translation failed, using original text');
            return text;
        }

        const res = await response.json();

        if (typeof res === 'string') {
            return res;
        }

        if (!res[0] || res[0].length === 0) {
            return text;
        }

        const result = (res[0].map((s: any) => s[0]).filter(Boolean).join('') as string)
            .replace(/\* ([^*]+)\*/g, '*$1*')
            .replace(/\*([^*]+) \*/g, '*$1*');

        return result;
    } catch (error) {
        console.error('[TTS] Translation error:', error);
        return text; // 에러 발생 시 원본 텍스트 반환
    }
}
