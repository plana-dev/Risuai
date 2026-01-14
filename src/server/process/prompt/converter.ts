/**
 * 프롬프트 변환 함수들
 * 원본: src/ts/process/prompt.ts
 */

import type { PromptItem, InstData } from './types';
import type { botPreset } from '../../database';
import type { OobaChatCompletionRequestParams } from '../../model/ooba';
import { OobaParams } from './types';

/**
 * ST Chat 프리셋을 Risuai 프롬프트 템플릿으로 변환
 */
export function stChatConvert(pre: any): PromptItem[] {
    // ST preset
    let promptTemplate: PromptItem[] = [];

    function findPrompt(identifier: number) {
        return pre.prompts.find((p: any) => p.identifier === identifier);
    }

    for (const prompt of pre?.prompt_order?.[0]?.order ?? []) {
        if (!prompt?.enabled) {
            continue;
        }
        const p = findPrompt(prompt?.identifier ?? '');
        if (p) {
            switch (p.identifier) {
                case 'main': {
                    promptTemplate.push({
                        type: 'plain',
                        type2: 'main',
                        text: p.content ?? '',
                        role: p.role ?? 'system',
                    });
                    break;
                }
                case 'jailbreak':
                case 'nsfw': {
                    promptTemplate.push({
                        type: 'jailbreak',
                        type2: 'normal',
                        text: p.content ?? '',
                        role: p.role ?? 'system',
                    });
                    break;
                }
                case 'dialogueExamples':
                case 'charPersonality':
                case 'scenario': {
                    break; // ignore
                }
                case 'chatHistory': {
                    promptTemplate.push({
                        type: 'chat',
                        rangeEnd: 'end',
                        rangeStart: 0,
                    });
                    break;
                }
                case 'worldInfoBefore': {
                    promptTemplate.push({
                        type: 'lorebook',
                    });
                    break;
                }
                case 'worldInfoAfter': {
                    break;
                }
                case 'charDescription': {
                    promptTemplate.push({
                        type: 'description',
                    });
                    break;
                }
                case 'personaDescription': {
                    promptTemplate.push({
                        type: 'persona',
                    });
                    break;
                }
                default: {
                    console.log(p);
                    promptTemplate.push({
                        type: 'plain',
                        type2: 'normal',
                        text: p.content ?? '',
                        role: p.role ?? 'system',
                    });
                }
            }
        } else {
            console.log('Prompt not found', prompt);
        }
    }

    if (pre?.assistant_prefill) {
        promptTemplate.push({
            type: 'postEverything',
        });
        promptTemplate.push({
            type: 'plain',
            type2: 'main',
            text: `{{#if {{prefill_supported}}}}${pre?.assistant_prefill}{{/if}}`,
            role: 'bot',
        });
    }

    return promptTemplate;
}

/**
 * 프롬프트 파일들을 Risuai 프리셋으로 변환
 * 서버 사이드에서는 데이터베이스에 직접 저장하지 않고 프리셋 객체를 반환
 */
export function promptConvertion(
    files: { name: string; content: string; type: string }[],
    presetTemplate: botPreset
): {
    preset: botPreset;
    error?: string;
} {
    let preset = JSON.parse(JSON.stringify(presetTemplate)); // safeStructuredClone 대체
    let instData: InstData = {
        system_prompt: '',
        input_sequence: '',
        output_sequence: '',
        last_output_sequence: '',
        system_sequence: '',
        stop_sequence: '',
        system_sequence_prefix: '',
        system_sequence_suffix: '',
        first_output_sequence: '',
        output_suffix: '',
        input_suffix: '',
        system_suffix: '',
        user_alignment_message: '',
        system_same_as_user: false,
        last_system_sequence: '',
        first_input_sequence: '',
        last_input_sequence: '',
        name: '',
    };
    let story_string = '';
    let chat_start = '';
    preset.name = '';

    let type = '';

    files = files.filter(x => x.type !== 'NOTSUPPORTED').sort((a, b) => {
        return typePriority.indexOf(a.type as any) - typePriority.indexOf(b.type as any);
    });

    if (files.findIndex(x => x.type === 'STINST') !== -1) {
        type = 'STINST';
    }
    if (files.findIndex(x => x.type === 'STCHAT') !== -1) {
        if (type !== '') {
            return {
                preset,
                error: `Both ${type} and STCHAT are not supported together.`,
            };
        }
        type = 'STCHAT';
    }

    let samplers: string[] = [];

    let oobaData: OobaChatCompletionRequestParams = {
        mode: 'instruct',
    };

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const data = JSON.parse(file.content);

        const getParam = (
            setname: keyof typeof preset,
            getname: string = '',
            arg: {
                multiplier?: number;
            } = {}
        ) => {
            if (getname === '') {
                getname = setname;
            }
            let multiplier = arg.multiplier ?? 1;
            if (samplers.includes(getname)) {
                // @ts-expect-error dynamic key access
                preset[setname] = data[getname] * multiplier;
            } else {
                // @ts-expect-error dynamic key assignment, -1000 indicates unset sampler
                preset[setname] = -1000;
            }

            if (OobaParams.includes(getname as any)) {
                oobaData[getname as keyof OobaChatCompletionRequestParams] = data[getname];
            }
        };

        preset.name ||= instData.name ?? '';
        switch (file.type) {
            case 'STINST': {
                instData = data as InstData;
                if (data.system_same_as_user) {
                    instData.system_sequence = '';
                    instData.system_sequence_prefix = instData.input_sequence;
                    instData.system_sequence_suffix = instData.output_sequence;
                }
                break;
            }
            case 'PARAMETERS': {
                samplers = data.samplers;
                getParam('temperature', 'temp', { multiplier: 100 });
                getParam('top_p');
                getParam('top_k');
                getParam('top_a');
                getParam('min_p');
                getParam('repetition_penalty', 'rep_pen');
                getParam('frequencyPenalty', 'freq_pen', { multiplier: 100 });
                getParam('PresensePenalty', 'presence_penalty', { multiplier: 100 });
                for (const key of OobaParams) {
                    if (samplers.includes(key) && data[key] !== undefined && data[key] !== null) {
                        oobaData[key as keyof OobaChatCompletionRequestParams] = data[key];
                    }
                }
                break;
            }
            case 'STCONTEXT': {
                story_string = data.story_string;
                chat_start = data.chat_start;
                break;
            }
            case 'STCHAT': {
                samplers = [];
                getParam('temperature', 'temperature', { multiplier: 100 });
                getParam('top_p');
                getParam('top_k');
                getParam('top_a');
                getParam('min_p');
                getParam('repetition_penalty', 'repetition_penalty');
                getParam('frequencyPenalty', 'frequency_penalty', { multiplier: 100 });
                getParam('PresensePenalty', 'presence_penalty', { multiplier: 100 });
                const prompts = stChatConvert(data);
                preset.promptTemplate = prompts;
            }
        }
    }

    if (type === 'STCHAT') {
        preset.aiModel = 'openrouter';
        preset.subModel = 'openrouter';
        preset.name ||= 'Converted from JSON';
        return { preset };
    }

    preset.reverseProxyOobaArgs = oobaData;

    preset.promptTemplate = [
        {
            type: 'plain',
            type2: 'main',
            text: '',
            role: 'system',
        },
        {
            type: 'description',
        },
        {
            type: 'persona',
        },
        {
            type: 'lorebook',
        },
        {
            type: 'chat',
            rangeStart: 0,
            rangeEnd: 'end',
        },
        {
            type: 'authornote',
        },
        {
            type: 'plain',
            type2: 'globalNote',
            text: '',
            role: 'system',
        },
    ];

    // build a jinja template from the instData
    let jinja = '';

    jinja += story_string
        .replace(/{{user}}/gi, '{{risu_user}}')
        .replace(/{{user}}/gi, '{{risu_user}}')
        .replace(/{{system_prompt}}/gi, instData.system_prompt)
        .replace(/{{system}}/gi, instData.system_prompt)
        .replace(/{{#if (.+?){{\/if}}/gis, '')
        .replace(/{{(.+?)}}/gi, '')
        .replace(/\n\n+/g, '\n\n');
    jinja += chat_start;
    jinja += `{% for message in messages %}`;
    jinja += `{% if message.role == 'user' %}`;
    jinja += instData.input_sequence;
    jinja += `{{ message.content }}`;
    jinja += instData.input_suffix;
    jinja += `{% endif %}`;
    jinja += `{% if message.role == 'assistant' %}`;
    jinja += instData.output_sequence;
    jinja += `{{ message.content }}`;
    jinja += instData.output_suffix;
    jinja += `{% endif %}`;
    jinja += `{% if message.role == 'system' %}`;
    jinja += instData.system_sequence;
    jinja += instData.system_sequence_prefix;
    jinja += `{{ message.content }}`;
    jinja += instData.system_sequence_suffix;
    jinja += instData.system_suffix;
    jinja += `{% endif %}`;
    jinja += `{% endfor %}`;
    jinja += instData.output_sequence;

    preset.instructChatTemplate = 'jinja';
    preset.JinjaTemplate = jinja;
    preset.aiModel = 'openrouter';
    preset.subModel = 'openrouter';
    preset.useInstructPrompt = true;

    preset.name ||= 'Converted from JSON';

    return { preset };
}

// typePriority import
import { typePriority } from './types';
