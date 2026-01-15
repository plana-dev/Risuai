/**
 * TTS (Text-to-Speech) 처리 함수
 * 원본: src/ts/process/tts.ts
 * 서버 사이드에서 사용할 수 있도록 개선
 * 
 * 주의: 서버 사이드에서는 오디오 재생이 불가능하므로,
 * 오디오 데이터를 생성하고 클라이언트로 전송하는 방식으로 동작합니다.
 */

import type { character, Database } from '../../database';
import { runTranslator, translateVox } from './translation';
// TODO: runVITS 서버 사이드 구현 필요 (transformers 모듈)

/**
 * TTS 처리
 * 서버 사이드에서는 오디오 데이터를 생성하고 반환합니다.
 * 
 * @param character - 캐릭터 정보
 * @param text - TTS할 텍스트
 * @param database - 데이터베이스
 * @returns 오디오 데이터 (base64 또는 URL)
 */
export async function sayTTS(
    character: character,
    text: string,
    database: Database
): Promise<{ audioData?: string; audioUrl?: string; error?: string }> {
    try {
        if (!character || !text) {
            return { error: 'Character or text is missing' };
        }

        // 마크다운 이탤릭 제거
        text = text.replace(/\*/g, '');

        // 따옴표만 읽기 모드
        if (character.ttsReadOnlyQuoted) {
            const matches = text.match(/["「](.*?)["」]/g);
            if (matches && matches.length > 0) {
                text = matches.map(match => match.slice(1, -1)).join('');
            } else {
                text = '';
            }
        }

        if (!text) {
            return { error: 'No text to synthesize' };
        }

        switch (character.ttsMode) {
            case 'elevenlab': {
                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${character.ttsSpeech}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'xi-api-key': database.elevenLabKey || '',
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: 'eleven_multilingual_v2',
                    }),
                });

                if (response.status >= 200 && response.status < 300) {
                    const audioBuffer = await response.arrayBuffer();
                    const base64 = Buffer.from(audioBuffer).toString('base64');
                    return {
                        audioData: `data:audio/mpeg;base64,${base64}`,
                    };
                } else {
                    const errorText = await response.text();
                    return { error: `ElevenLabs API error: ${errorText}` };
                }
            }
            case 'VOICEVOX': {
                // 일본어로 번역 (VOICEVOX는 일본어만 지원)
                const jpText = await translateVox(text, database, userId || '');
                const queryResponse = await fetch(
                    `${database.voicevoxUrl}/audio_query?text=${encodeURIComponent(jpText)}&speaker=${character.ttsSpeech}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                    }
                );

                if (queryResponse.status === 200) {
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

                    const synthesisResponse = await fetch(
                        `${database.voicevoxUrl}/synthesis?speaker=${character.ttsSpeech}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(bodyData),
                        }
                    );

                    if (synthesisResponse.status === 200 && synthesisResponse.headers.get('content-type') === 'audio/wav') {
                        const audioBuffer = await synthesisResponse.arrayBuffer();
                        const base64 = Buffer.from(audioBuffer).toString('base64');
                        return {
                            audioData: `data:audio/wav;base64,${base64}`,
                        };
                    }
                }
                return { error: 'VOICEVOX synthesis failed' };
            }
            case 'openai': {
                const response = await fetch('https://api.openai.com/v1/audio/speech', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${database.openAIKey}`,
                    },
                    body: JSON.stringify({
                        model: 'tts-1',
                        input: text,
                        voice: character.oaiVoice || 'alloy',
                    }),
                });

                if (response.ok) {
                    const audioBuffer = await response.arrayBuffer();
                    const base64 = Buffer.from(audioBuffer).toString('base64');
                    return {
                        audioData: `data:audio/mpeg;base64,${base64}`,
                    };
                } else {
                    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
                    return { error: `OpenAI TTS error: ${errorData.error?.message || 'Unknown error'}` };
                }
            }
            case 'novelai': {
                if (text === '') {
                    return { error: 'Empty text' };
                }

                const encodedText = encodeURIComponent(text);
                const encodedSeed = encodeURIComponent(character.naittsConfig?.voice || '-1');
                const url = `https://api.novelai.net/ai/generate-voice?text=${encodedText}&voice=-1&seed=${encodedSeed}&opus=false&version=${character.naittsConfig?.version || 'v1'}`;

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${database.NAIApiKey}`,
                    },
                });

                if (response.ok) {
                    const audioBuffer = await response.arrayBuffer();
                    const base64 = Buffer.from(audioBuffer).toString('base64');
                    return {
                        audioData: `data:audio/mpeg;base64,${base64}`,
                    };
                } else {
                    return { error: 'NovelAI TTS error' };
                }
            }
            case 'huggingface': {
                // 언어 번역 (필요한 경우)
                let translatedText = text;
                if (character.hfTTS?.language && character.hfTTS.language !== 'en' && userId) {
                    translatedText = await runTranslator(text, false, 'en', character.hfTTS.language, database, userId);
                }

                const response = await fetch(`https://api-inference.huggingface.co/models/${character.hfTTS?.model}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${database.huggingfaceKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: translatedText,
                    }),
                });

                if (response.status === 503) {
                    const json = await response.json();
                    if (json.estimated_time) {
                        // 재시도 로직은 클라이언트에서 처리
                        return { error: `Model is loading. Estimated time: ${json.estimated_time}s` };
                    }
                } else if (response.status >= 400) {
                    const errorText = await response.text();
                    return { error: `HuggingFace TTS error: ${errorText}` };
                } else if (response.status === 200) {
                    const audioBuffer = await response.arrayBuffer();
                    const base64 = Buffer.from(audioBuffer).toString('base64');
                    return {
                        audioData: `data:audio/wav;base64,${base64}`,
                    };
                }
                return { error: 'HuggingFace TTS failed' };
            }
            case 'vits': {
                // TODO: runVITS 서버 사이드 구현 필요 (transformers 모듈)
                return { error: 'VITS TTS is not yet implemented on server side' };
            }
            case 'gptsovits': {
                // GPT-SoVITS는 서버 URL 필요
                if (!character.gptSoVitsConfig?.url) {
                    return { error: 'GPT-SoVITS URL is not configured' };
                }

                // TODO: ref_audio_data 처리 (에셋 서비스에서 가져오기)
                const body = {
                    text: text,
                    text_lang: character.gptSoVitsConfig.text_lang || 'auto',
                    ref_audio_path: character.gptSoVitsConfig.ref_audio_path || undefined,
                    ref_audio_name: character.gptSoVitsConfig.ref_audio_data?.fileName || undefined,
                    ref_audio_data: undefined, // TODO: base64로 변환 필요
                    prompt_text: character.gptSoVitsConfig.use_prompt ? character.gptSoVitsConfig.prompt : undefined,
                    prompt_lang: character.gptSoVitsConfig.prompt_lang || 'auto',
                    top_p: character.gptSoVitsConfig.top_p || 0.7,
                    temperature: character.gptSoVitsConfig.temperature || 0.7,
                    speed_factor: character.gptSoVitsConfig.speed || 1.0,
                    top_k: character.gptSoVitsConfig.top_k || 6,
                    text_split_method: character.gptSoVitsConfig.text_split_method || 'cut0',
                    parallel_infer: true,
                    ref_free: character.gptSoVitsConfig.use_long_audio || !character.gptSoVitsConfig.use_prompt,
                };

                const response = await fetch(`${character.gptSoVitsConfig.url}/tts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                });

                if (response.ok) {
                    const audioBuffer = await response.arrayBuffer();
                    const base64 = Buffer.from(audioBuffer).toString('base64');
                    return {
                        audioData: `data:audio/wav;base64,${base64}`,
                    };
                } else {
                    const errorText = Buffer.from(await response.arrayBuffer()).toString('utf-8');
                    return { error: `GPT-SoVITS error: ${errorText}` };
                }
            }
            case 'fishspeech': {
                if (!character.fishSpeechConfig?.model?._id) {
                    return { error: 'FishSpeech Model is not selected' };
                }

                const body = {
                    text: text,
                    reference_id: character.fishSpeechConfig.model._id,
                    chunk_length: character.fishSpeechConfig.chunk_length || 100,
                    normalize: character.fishSpeechConfig.normalize || false,
                    format: 'mp3',
                    mp3_bitrate: 192,
                };

                const response = await fetch('https://api.fish.audio/v1/tts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${database.fishSpeechKey}`,
                    },
                    body: JSON.stringify(body),
                });

                if (response.ok) {
                    const audioBuffer = await response.arrayBuffer();
                    const base64 = Buffer.from(audioBuffer).toString('base64');
                    return {
                        audioData: `data:audio/mp3;base64,${base64}`,
                    };
                } else {
                    const errorText = Buffer.from(await response.arrayBuffer()).toString('utf-8');
                    return { error: `FishSpeech error: ${errorText}` };
                }
            }
            case 'webspeech': {
                // Web Speech API는 브라우저 전용이므로 서버에서는 지원 불가
                return { error: 'Web Speech API is not supported on server side' };
            }
            default: {
                return { error: `Unsupported TTS mode: ${character.ttsMode}` };
            }
        }
    } catch (error) {
        console.error('[TTS] Error:', error);
        return { error: error instanceof Error ? error.message : 'Unknown TTS error' };
    }
}

/**
 * OpenAI TTS 목소리 목록
 */
export const oaiVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

/**
 * ElevenLabs TTS 목소리 목록 가져오기
 */
export async function getElevenTTSVoices(database: Database): Promise<any[]> {
    try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': database.elevenLabKey || '',
            },
        });
        const res = await response.json();
        return res.voices || [];
    } catch (error) {
        console.error('[TTS] Error getting ElevenLabs voices:', error);
        return [];
    }
}

/**
 * VOICEVOX 목소리 목록 가져오기
 */
export async function getVOICEVOXVoices(database: Database): Promise<any[]> {
    try {
        const speakerData = await fetch(`${database.voicevoxUrl}/speakers`);
        const speakerList = await speakerData.json();
        const speakersInfo = speakerList.map((speaker: any) => {
            const styles = speaker.styles.map((style: any) => {
                return { name: style.name, id: `${style.id}` };
            });
            return { name: speaker.name, list: JSON.stringify(styles) };
        });
        speakersInfo.unshift({ name: 'None', list: null });
        return speakersInfo;
    } catch (error) {
        console.error('[TTS] Error getting VOICEVOX voices:', error);
        return [];
    }
}

/**
 * NovelAI 목소리 목록
 */
export function getNovelAIVoices() {
    return [
        {
            gender: 'UNISEX',
            voices: ['Anananan'],
        },
        {
            gender: 'FEMALE',
            voices: ['Aini', 'Orea', 'Claea', 'Lim', 'Aurae', 'Naia'],
        },
        {
            gender: 'MALE',
            voices: ['Aulon', 'Elei', 'Ogma', 'Raid', 'Pega', 'Lam'],
        },
    ];
}

/**
 * NovelAI TTS 설정 수정
 */
export function FixNAITTS(data: character): character {
    if (data.naittsConfig === undefined) {
        data.naittsConfig = {
            voice: 'Anananan',
            version: 'v1',
        };
    }
    return data;
}
