/**
 * Inlay Screen 처리 함수
 * 원본: src/ts/process/inlayScreen.ts
 * 서버 사이드에서 사용할 수 있도록 개선
 */

import type { character, Database } from '../../database';
import { generateAIImage } from './image-generation';
import { writeInlayImage } from './file-processing';

const imggenRegex = [/<ImgGen="(.+?)">/gi, /{{ImgGen="(.+?)"}}/gi] as const;

/**
 * Inlay Screen 처리
 * Emotion 및 ImgGen 태그를 처리합니다.
 */
export async function runInlayScreen(
    char: character,
    data: string,
    database: Database,
    userId: string
): Promise<{ text: string; promise?: Promise<string> }> {
    if (char.inlayViewScreen) {
        if (char.viewScreen === 'emotion') {
            return { text: data.replace(/<Emotion="(.+?)">/gi, '{{emotion::$1}}') };
        }
        if (char.viewScreen === 'imggen') {
            return {
                text: data.replace(imggenRegex[0], '[Generating...]').replace(imggenRegex[1], '[Generating...]'),
                promise: (async () => {
                    let processedData = data;
                    for (const regex of imggenRegex) {
                        const promises: Promise<string | false>[] = [];
                        const neg = char.newGenData?.negative || '';
                        processedData.replace(regex, (match, p1) => {
                            const prompt = (char.newGenData?.prompt || '{{slot}}').replaceAll('{{slot}}', p1);
                            promises.push(
                                (async () => {
                                    const v = await generateAIImage(prompt, char, neg, 'inlay', database);
                                    if (!v) {
                                        return '';
                                    }
                                    // 서버 사이드에서는 이미지 URL 또는 base64를 반환
                                    // writeInlayImage는 서버에서 처리
                                    const inlay = await writeInlayImageFromUrl(v, {
                                        name: `img_${Date.now()}.png`,
                                        ext: 'png',
                                    }, userId);
                                    return inlay;
                                })()
                            );
                            return match;
                        });
                        const d = await Promise.all(promises);
                        processedData = processedData.replace(regex, () => {
                            const result = d.shift();
                            if (result === false || !result) {
                                return '';
                            }
                            return result;
                        });
                    }
                    return processedData;
                })(),
            };
        }
    }

    return { text: data };
}

/**
 * URL 또는 base64에서 이미지를 다운로드하고 Inlay 이미지로 변환
 */
async function writeInlayImageFromUrl(
    imageUrlOrBase64: string,
    arg: { name?: string; ext?: string; id?: string } = {},
    userId: string
): Promise<string> {
    try {
        let imageData: Uint8Array;
        
        if (imageUrlOrBase64.startsWith('data:')) {
            // Base64 이미지
            const base64Data = imageUrlOrBase64.split(',')[1];
            imageData = new Uint8Array(Buffer.from(base64Data, 'base64'));
        } else {
            // URL에서 이미지 가져오기
            const response = await fetch(imageUrlOrBase64);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }
            const imageBuffer = await response.arrayBuffer();
            imageData = new Uint8Array(imageBuffer);
        }

        // writeInlayImage 호출 (서버 사이드 버전)
        return await writeInlayImage(imageData, arg, userId);
    } catch (error) {
        console.error('[writeInlayImageFromUrl] Error:', error);
        return '';
    }
}

/**
 * Inlay Screen 설정 업데이트
 */
export function updateInlayScreen(char: character): character {
    switch (char.viewScreen) {
        case 'emotion':
            if (char.inlayViewScreen) {
                char.newGenData = {
                    prompt: '',
                    negative: '',
                    instructions: '',
                    emotionInstructions: `You must always output the character's emotional image as a command at the end of a conversation. The command must be selected from a given list, and it's better to have variety than to repeat images used in previous chats. Use one image, depending on the character's emotion. See the list below. Form: <Emotion="<image command>"> Example: <Emotion="Agree"> List of commands: {{slot}}`,
                };
                return char;
            }
            char.newGenData = {
                prompt: '',
                negative: '',
                instructions: '',
                emotionInstructions: `You must always output the character's emotional image as a command. The command must be selected from a given list, only output the command, depending on the character's emotion. List of commands: {{slot}}`,
            };
            return char;
        case 'imggen':
            if (char.inlayViewScreen) {
                char.newGenData = {
                    prompt: 'best quality, {{slot}}',
                    negative: 'worse quality',
                    instructions:
                        "You must always output the character's image as a keyword-formatted prompts that can be used in stable diffusion  at the end of a conversation. Use one image, depending on character, place, situation, etc. keyword should be long enough. Form: <ImgGen=\"<keyword-formatted prompt>\">",
                    emotionInstructions: '',
                };
                return char;
            }
            char.newGenData = {
                prompt: 'best quality, {{slot}}',
                negative: 'worse quality',
                instructions:
                    "You must always output the character's image as a keyword-formatted prompts that can be used in stable diffusion. only output the that prompt, depending on character, place, situation, etc. keyword should be long enough.",
                emotionInstructions: '',
            };
            return char;
        default:
            char.newGenData = {
                prompt: '',
                negative: '',
                instructions: '',
                emotionInstructions: '',
            };
            return char;
    }
}
