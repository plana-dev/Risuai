/**
 * 템플릿 관련 함수들
 * 원본: src/ts/process/templates/jsonSchema.ts, src/ts/process/templates/chatTemplate.ts
 */

import type { Database, character } from '../../database';
import type { OpenAIChat } from '../types';
import { risuChatParser } from '../../parser';
import { jsonOutputTrimmer } from '../../util';
import { Template } from '@huggingface/jinja';

/**
 * Interface를 JSON Schema로 변환
 */
export function convertInterfaceToSchema(
    int: string,
    parserContexts?: {
        parser: any;
        matcher: any;
        block: any;
    }
): any {
    if (!int.startsWith('interface ') && !int.startsWith('export interface ')) {
        return JSON.parse(int);
    }

    // risuChatParser 사용 (contexts가 있으면 사용)
    if (parserContexts) {
        int = risuChatParser(int, {}, parserContexts);
    } else {
        // contexts가 없으면 기본 파싱만 수행
        int = risuChatParser(int, {}, {
            parser: {
                getDatabase: () => ({} as Database),
                getSelectedCharID: () => 0,
                findCharacterbyId: () => null,
            },
            matcher: {
                calcString: () => 0,
                getMatcherMap: () => new Map(),
                initMatcher: () => {},
            },
            block: {
                getChatVar: () => '',
                getGlobalChatVar: () => '',
            },
        });
    }

    type SchemaProp = {
        "type": "array" | "string" | "number" | "boolean",
        "items"?: SchemaProp
        "enum"?: string[]
        "const"?: string
    }

    const lines = int.split('\n');
    let schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": false,
        "properties": {} as { [key: string]: SchemaProp },
        "required": [] as string[],
    };

    for (let i = 1; i < lines.length; i++) {
        let content = lines[i].trim();
        if (content === '{') {
            continue;
        }
        if (content === '}') {
            continue;
        }
        if (content === '') {
            continue;
        }

        let placeHolders: string[] = [];

        content = content
            .replace(/\\"/gu, '\uE9b4a')
            .replace(/\\'/gu, '\uE9b4b')
            .replace(/"(.+?)"/gu, function (match, p1) {
                placeHolders.push(match);
                return `\uE9b4d${placeHolders.length - 1}`;
            })
            .replace(/'(.+?)'/gu, function (match, p1) {
                placeHolders.push(`"${p1}"`);
                return `\uE9b4d${placeHolders.length - 1}`;
            })
            .split('//')[0].trim() // remove comments
            .replace(/((number)|(string)|(boolean))\[\]/gu, 'Array<$1>');

        if (content.endsWith(',') || content.endsWith(';')) {
            content = content.slice(0, -1);
        }

        let spData = content.replace(/ /g, '').split(':');

        if (spData.length !== 2) {
            throw "SyntaxError Found";
        }

        let [property, typeData] = spData;

        switch (typeData) {
            case 'string':
            case 'number':
            case 'boolean': {
                schema.properties[property] = {
                    type: typeData
                };
                break;
            }
            case 'Array<string>':
            case 'Array<number>':
            case 'Array<boolean>': {
                const ogType = typeData.slice(6, -1);

                schema.properties[property] = {
                    type: 'array',
                    items: {
                        type: ogType as 'string' | 'number' | 'boolean'
                    }
                };
                break;
            }
            default: {
                const types = typeData.split("|");
                const strings: string[] = [];
                for (const t of types) {
                    if (!t.startsWith('\uE9b4d')) {
                        throw "Unsupported Type Detected";
                    }
                    const textIndex = t.replace('\uE9b4d', '');
                    const text = placeHolders[parseInt(textIndex)];
                    const textParsed = JSON.parse(text.replace(/\uE9b4a/gu, '\\"').replace(/\uE9b4b/gu, "\\'"));
                    strings.push(textParsed);
                }
                if (strings.length === 1) {
                    schema.properties[property] = {
                        type: 'string',
                        const: strings[0]
                    };
                }
                else {
                    schema.properties[property] = {
                        type: 'string',
                        enum: strings
                    };
                }
            }
        }

        schema.required.push(property);
    }

    return schema;
}

/**
 * OpenAI JSON Schema 생성
 */
export function getOpenAIJSONSchema(
    schema: string | undefined,
    database: Database,
    parserContexts?: {
        parser: any;
        matcher: any;
        block: any;
    }
): {
    name: string;
    strict: boolean;
    schema: any;
} {
    return {
        "name": "format",
        "strict": database.strictJsonSchema,
        "schema": convertInterfaceToSchema(schema ?? database.jsonSchema, parserContexts)
    };
}

/**
 * JSON에서 특정 경로의 값을 추출
 */
export function extractJSON(
    data: string | any,
    format: string,
    parserContexts?: {
        parser: any;
        matcher: any;
        block: any;
    }
): string {
    const extract = (data: any, format: string): string => {
        try {
            if (data === undefined || data === null) {
                return '';
            }

            const fp = format.split('.');
            const current = data[fp[0]];

            if (current === undefined) {
                return '';
            }
            else if (fp.length === 1) {
                return `${current ?? ''}`;
            }
            else if (typeof current === 'object') {
                return extractJSON(current, fp.slice(1).join('.'), parserContexts);
            }
            else if (Array.isArray(current)) {
                const index = parseInt(fp[1]);
                return extractJSON(current[index], fp.slice(1).join('.'), parserContexts);
            }
            else {
                return `${current ?? ''}`;
            }
        } catch (error) {
            return '';
        }
    };

    try {
        // format을 risuChatParser로 파싱
        if (parserContexts) {
            format = risuChatParser(format, {}, parserContexts);
        } else {
            format = risuChatParser(format, {}, {
                parser: {
                    getDatabase: () => ({} as Database),
                    getSelectedCharID: () => 0,
                    findCharacterbyId: () => null,
                },
                matcher: {
                    calcString: () => 0,
                    getMatcherMap: () => new Map(),
                    initMatcher: () => {},
                },
                block: {
                    getChatVar: () => '',
                    getGlobalChatVar: () => '',
                },
            });
        }

        if (typeof data === 'string') {
            data = data.trim();
            if (data.startsWith('{')) {
                return extract(JSON.parse(jsonOutputTrimmer(data)), format);
            }
        } else {
            // 이미 객체인 경우
            return extract(data, format);
        }
    } catch (error) {
        // Ignore errors
    }

    return typeof data === 'string' ? data : '';
}

/**
 * Chat 템플릿 상수
 */
export const chatTemplates = {
    'llama3': "{% set bos_token = '<|begin_of_text|>' %}{% set loop_messages = messages %}{% for message in loop_messages %}{% set content = '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n'+ message['content'] | trim + '<|eot_id|>' %}{% if loop.index0 == 0 %}{% set content = bos_token + content %}{% endif %}{{ content }}{% endfor %}{{ '<|start_header_id|>assistant<|end_header_id|>\n\n' }}",
    'llama2': `{% set bos_token = '<|begin_of_text|>' %}{% if messages[0]['role'] == 'system' %}{% set loop_messages = messages[1:] %}{% set system_message = messages[0]['content'] %}{% elif USE_DEFAULT_PROMPT == true and not '<<SYS>>' in messages[0]['content'] %}{% set loop_messages = messages %}{% set system_message = 'DEFAULT_SYSTEM_MESSAGE' %}{% else %}{% set loop_messages = messages %}{% set system_message = false %}{% endif %}{% for message in loop_messages %}{% if (message['role'] == 'user') != (loop.index0 % 2 == 0) %}{{ raise_exception('Conversation roles must alternate user/assistant/user/assistant/...') }}{% endif %}{% if loop.index0 == 0 and system_message != false %}{% set content = '<<SYS>>\n' + system_message + '\n<</SYS>>\n\n' + message['content'] %}{% else %}{% set content = message['content'] %}{% endif %}{% if message['role'] == 'user' %}{{ bos_token + '[INST] ' + content.strip() + ' [/INST]' }}{% elif message['role'] == 'system' %}{{ '<<SYS>>\n' + content.strip() + '\n<</SYS>>\n\n' }}{% elif message['role'] == 'assistant' %}{{ ' '  + content.strip() + ' ' + eos_token }}{% endif %}{% endfor %}`,
    'chatml': `{% for message in messages %}{{'<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>' + '\n'}}{% endfor %}{% if add_generation_prompt %}{{ '<|im_start|>assistant\n' }}{% endif %}`,
    'gpt2': `{% for message in messages %}{{'<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>' + '\n'}}{% endfor %}{% if add_generation_prompt %}{{ '<|im_start|>assistant\n' }}{% endif %}`,
    'gemma': "{% if messages[0]['role'] == 'system' %}{{ raise_exception('System role not supported') }}{% endif %}{% for message in messages %}{% if (message['role'] == 'user') != (loop.index0 % 2 == 0) %}{{ raise_exception('Conversation roles must alternate user/assistant/user/assistant/...') }}{% endif %}{% if (message['role'] == 'assistant') %}{% set role = 'model' %}{% else %}{% set role = message['role'] %}{% endif %}{{ '<start_of_turn>' + role + '\n' + message['content'] | trim + '<end_of_turn>\n' }}{% endfor %}{% if add_generation_prompt %}{{'<start_of_turn>model\n'}}{% endif %}",
    'mistral': "{% for message in messages %}{% if message['role'] == 'user' %}{{ ' [INST] ' + message['content'] + ' [/INST]' }}{% elif message['role'] == 'assistant' %}{{ ' ' + message['content'] + ' ' + eos_token}}{% else %}{{ raise_exception('Only user and assistant roles are supported!') }}{% endif %}{% endfor %}",
    'vicuna': "{%- set ns = namespace(found=false) -%}\n{%- for message in messages -%}\n    {%- if message['role'] == 'system' -%}\n        {%- set ns.found = true -%}\n    {%- endif -%}\n{%- endfor -%}\n{%- if not ns.found -%}\n    {{- '' + 'A chat between a curious user and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the user\\'s questions.' + '\\n\\n' -}}\n{%- endif %}\n{%- for message in messages %}\n    {%- if message['role'] == 'system' -%}\n        {{- '' + message['content'] + '\\n\\n' -}}\n    {%- else -%}\n        {%- if message['role'] == 'user' -%}\n            {{-'USER: ' + message['content'] + '\\n'-}}\n        {%- else -%}\n            {{-'ASSISTANT: ' + message['content'] + '</s>\\n' -}}\n        {%- endif -%}\n    {%- endif -%}\n{%- endfor -%}\n{%- if add_generation_prompt -%}\n    {{-'ASSISTANT:'-}}\n{%- endif -%}",
    "alpaca": "{%- set ns = namespace(found=false) -%}\n{%- for message in messages -%}\n    {%- if message['role'] == 'system' -%}\n        {%- set ns.found = true -%}\n    {%- endif -%}\n{%- endfor -%}\n{%- if not ns.found -%}\n    {{- '' + 'Below is an instruction that describes a task. Write a response that appropriately completes the request.' + '\\n\\n' -}}\n{%- endif %}\n{%- for message in messages %}\n    {%- if message['role'] == 'system' -%}\n        {{- '' + message['content'] + '\\n\\n' -}}\n    {%- else -%}\n        {%- if message['role'] == 'user' -%}\n            {{-'### Instruction:\\n' + message['content'] + '\\n\\n'-}}\n        {%- else -%}\n            {{-'### Response:\\n' + message['content'] + '\\n\\n' -}}\n        {%- endif -%}\n    {%- endif -%}\n{%- endfor -%}\n{%- if add_generation_prompt -%}\n    {{-'### Response:\\n'-}}\n{%- endif -%}"
};

type TemplateEffect = 'no_system_messages' | 'alter_user_assistant_roles';

export const templateEffect = {
    'gemma': [
        'no_system_messages',
    ],
    'mistral': [
        'no_system_messages',
        'alter_user_assistant_roles',
    ],
} as { [key: string]: TemplateEffect[] };

/**
 * Chat 템플릿 적용
 */
export function applyChatTemplate(
    messages: OpenAIChat[],
    database: Database,
    character?: character,
    arg: {
        type?: string;
        custom?: string;
    } = {}
): string {
    const type = arg.type ?? database.instructChatTemplate;
    if (!type) {
        throw new Error('Template type is not set');
    }

    // safeStructuredClone 대체
    let clonedMessages = JSON.parse(JSON.stringify(messages));
    const template = type === 'jinja' 
        ? (new Template(arg.custom ?? database.JinjaTemplate)) 
        : (new Template(chatTemplates[type]));

    let formatedMessages: {
        "role": 'user' | 'assistant' | 'system',
        "content": string
    }[] = [];

    const effects = templateEffect[type] ?? [];
    const noSystemMessages = effects.includes('no_system_messages');
    const alterUserAssistantRoles = effects.includes('alter_user_assistant_roles');

    for (let i = 0; i < clonedMessages.length; i++) {
        const message = clonedMessages[i];
        if (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'system') {
            continue;
        }

        if (noSystemMessages && message.role === 'system') {
            message.role = 'user';
            message.content = 'System: ' + message.content;
        }

        if (alterUserAssistantRoles) {
            if (message.role === 'user') {
                if (formatedMessages.length % 2 === 0) {
                    formatedMessages.push({
                        "role": "user",
                        "content": message.content
                    });
                }
                else {
                    formatedMessages[formatedMessages.length - 1].content += "\n" + message.content;
                }
            }
            else {
                if (formatedMessages.length % 2 === 1 || formatedMessages.length === 0) {
                    if (formatedMessages.length === 0) {
                        formatedMessages.push({
                            "role": "user",
                            "content": ""
                        });
                    }
                    formatedMessages.push({
                        "role": "assistant",
                        "content": message.content
                    });
                }
                else {
                    formatedMessages[formatedMessages.length - 1].content += "\n" + message.content;
                }
            }
        }
        else {
            formatedMessages.push({
                "role": message.role,
                "content": message.content
            });
        }
    }

    return template.render({
        "messages": formatedMessages,
        "add_generation_prompt": true,
        "risu_char": character?.name || '',
        "risu_user": database.username || 'User',
        "eos_token": "",
        "bos_token": "",
    });
}
