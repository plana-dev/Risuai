/**
 * 이미지 생성 (ComfyUI만 지원)
 * 원본: src/ts/process/stableDiff.ts
 */

import type { character, Database } from '../../database';
import type { ImageGenerationResult } from './types';
import type { OpenAIChat } from '../types';
import { requestChatData } from '../request';

/**
 * generateAIImage 호환 함수
 * 원본: src/ts/process/stableDiff.ts의 generateAIImage
 * 서버 사이드에서는 ComfyUI만 지원
 * 
 * 주의: database는 ProcessContext에서 가져와야 하지만, 호환성을 위해 선택적 파라미터로 받음
 */
export async function generateAIImage(
    genPrompt: string,
    currentChar: character,
    neg: string,
    returnSdData: string,
    database?: Database
): Promise<string | false> {
    // database가 없으면 에러 반환
    if (!database) {
        console.error('[generateAIImage] Database is required');
        return false;
    }

    // 현재는 ComfyUI만 지원
    // TODO: WebUI, NovelAI 등 다른 provider 지원 추가
    if (returnSdData === 'inlay') {
        const result = await generateImageWithComfyUI(genPrompt, neg, currentChar, database);
        if (result.success && result.image) {
            return result.image;
        }
        return false;
    } else {
        // 일반 이미지 생성 (emotion 등)
        const result = await generateImageWithComfyUI(genPrompt, neg, currentChar, database);
        if (result.success && result.image) {
            // TODO: emotion 저장 로직 추가
            return result.image;
        }
        return false;
    }
}

/**
 * ComfyUI 이미지 생성
 */
export async function generateImageWithComfyUI(
    prompt: string,
    negativePrompt: string,
    character: character,
    database: Database
): Promise<ImageGenerationResult> {
    if (!database.comfyUiUrl) {
        return {
            success: false,
            error: 'ComfyUI URL is not configured',
        };
    }

    try {
        const baseUrl = new URL(database.comfyUiUrl);
        const pathname = '/prompt';

        // ComfyUI API URL 구성
        const url = database.comfyUiUrl.endsWith('/api')
            ? new URL(`${database.comfyUiUrl}${pathname}`)
            : new URL(pathname, baseUrl);

        // ComfyUI 워크플로우 구성
        const workflow = getDefaultComfyUIWorkflow(prompt, negativePrompt, database);
        
        if (!workflow || Object.keys(workflow).length === 0) {
            return {
                success: false,
                error: 'ComfyUI workflow is not configured',
            };
        }

        // ComfyUI API 요청
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: workflow }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                error: `ComfyUI API error: ${errorText}`,
            };
        }

        const data = await response.json();
        const promptId = data.prompt_id;

        // 이미지 생성 완료 대기
        const image = await waitForComfyUIImage(database.comfyUiUrl, promptId, database);

        if (!image) {
            return {
                success: false,
                error: 'Failed to get image from ComfyUI',
            };
        }

        return {
            success: true,
            image: `data:image/png;base64,${image}`,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * 기본 ComfyUI 워크플로우 생성
 */
function getDefaultComfyUIWorkflow(prompt: string, negativePrompt: string, database: Database): any {
    // 데이터베이스에서 워크플로우 가져오기
    if (database.comfyConfig?.workflow) {
        try {
            const workflow = JSON.parse(database.comfyConfig.workflow);
            const legacy = database.sdProvider === 'comfy'; // Legacy Comfy mode

            if (legacy) {
                // Legacy 모드: 특정 노드에 직접 할당
                const { posNodeID, posInputName, negNodeID, negInputName } = database.comfyConfig;
                if (posNodeID && posInputName) {
                    workflow[posNodeID].inputs[posInputName] = prompt;
                }
                if (negNodeID && negInputName) {
                    workflow[negNodeID].inputs[negInputName] = negativePrompt;
                }
            } else {
                // 새 모드: 모든 노드에서 {{risu_prompt}}와 {{risu_neg}} 치환
                const keys = Object.keys(workflow);
                for (let i = 0; i < keys.length; i++) {
                    const node = workflow[keys[i]];
                    const inputKeys = Object.keys(node.inputs);
                    for (let j = 0; j < inputKeys.length; j++) {
                        let input = node.inputs[inputKeys[j]];
                        if (typeof input === 'string') {
                            input = input.replaceAll('{{risu_prompt}}', prompt);
                            input = input.replaceAll('{{risu_neg}}', negativePrompt);
                        }

                        // seed 랜덤화
                        if (inputKeys[j] === 'seed' && typeof input === 'number') {
                            input = Math.floor(Math.random() * 1000000000);
                        }

                        node.inputs[inputKeys[j]] = input;
                    }
                }
            }

            return workflow;
        } catch (error) {
            console.error('[ComfyUI] Error parsing workflow:', error);
        }
    }

    // 기본 워크플로우 (간단한 txt2img 구조)
    // TODO: 실제 ComfyUI API 문서에 따라 구성
    return {};
}

/**
 * ComfyUI 이미지 생성 완료 대기
 */
async function waitForComfyUIImage(
    comfyUiUrl: string,
    promptId: string,
    database: Database,
    maxWaitTime: number = 300000
): Promise<string | null> {
    const startTime = Date.now();
    const timeout = (database.comfyConfig?.timeout || 300) * 1000;
    const actualTimeout = Math.min(maxWaitTime, timeout);

    const baseUrl = new URL(comfyUiUrl);
    const createUrl = (pathname: string, params: Record<string, string> = {}) => {
        const url = comfyUiUrl.endsWith('/api')
            ? new URL(`${comfyUiUrl}${pathname}`, baseUrl)
            : new URL(pathname, baseUrl);
        url.search = new URLSearchParams(params).toString();
        return url.toString();
    };

    while (Date.now() - startTime < actualTimeout) {
        try {
            const historyUrl = createUrl('/history');
            const response = await fetch(historyUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            const data = await response.json();
            const item = data[promptId];

            if (item && item.outputs) {
                // 이미지 노드에서 이미지 가져오기
                const genImgInfo = Object.values(item.outputs)
                    .flatMap((output: any) => output.images || [])[0];

                if (genImgInfo) {
                    const viewUrl = createUrl('/view', {
                        filename: genImgInfo.filename,
                        subfolder: genImgInfo.subfolder || '',
                        type: genImgInfo.type || 'output',
                    });

                    // 이미지 다운로드 및 base64 변환
                    const imageResponse = await fetch(viewUrl, {
                        method: 'GET',
                    });

                    if (imageResponse.ok) {
                        const imageBuffer = await imageResponse.arrayBuffer();
                        const base64 = Buffer.from(imageBuffer).toString('base64');
                        return base64;
                    }
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('[ComfyUI] Error waiting for image:', error);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return null;
}

/**
 * stableDiff 함수 (서버 사이드)
 * 프롬프트 생성 후 ComfyUI로 이미지 생성
 * 원본: src/ts/process/stableDiff.ts의 stableDiff
 */
export async function stableDiff(
    character: character,
    prompt: string,
    database: Database,
    userId: string
): Promise<ImageGenerationResult> {
    // 프롬프트 생성 (LLM 사용)
    if (character.newGenData?.instructions) {
        const promptItem = `Chat:\n${prompt}`;

        const promptbody: OpenAIChat[] = [
            {
                role: 'system',
                content: character.newGenData.instructions,
            },
            {
                role: 'user',
                content: promptItem,
            },
        ];

        const rq = await requestChatData(
            {
                formated: promptbody,
                currentChar: character,
                temperature: 0.2,
                maxTokens: 300,
                bias: {},
                useStreaming: false,
                noMultiGen: true,
            },
            'submodel',
            database,
            null,
            userId
        );

        if (rq.type === 'fail') {
            return {
                success: false,
                error: rq.result,
            };
        }

        if (rq.type === 'streaming' || rq.type === 'multiline') {
            return {
                success: false,
                error: 'Unexpected response type',
            };
        }

        const generatedPrompt = rq.result;
        const genPrompt = character.newGenData.prompt?.replaceAll('{{slot}}', generatedPrompt) || generatedPrompt;
        const neg = character.newGenData.negative || '';

        return await generateImageWithComfyUI(genPrompt, neg, character, database);
    }

    // 프롬프트 생성 없이 직접 사용
    const genPrompt = character.newGenData?.prompt?.replaceAll('{{slot}}', prompt) || prompt;
    const neg = character.newGenData?.negative || '';

    return await generateImageWithComfyUI(genPrompt, neg, character, database);
}
