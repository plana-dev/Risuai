import type { OpenAIChat } from '../types';
import type { character } from '../../database';
import type { ProcessContext } from '../context';

/**
 * Parses example messages from character's exampleMessage field
 * 
 * @param char - Character object
 * @param userName - User name
 * @param context - Process context (for risuChatParser)
 * @returns Array of parsed example messages
 */
export function exampleMessage(
    char: character,
    userName: string,
    context: ProcessContext
): OpenAIChat[] {
    if (char.exampleMessage === '') {
        return [];
    }

    const messages = char.exampleMessage.split('\n');
    let result: OpenAIChat[] = [];
    let currentMessage: OpenAIChat | null = null;

    function add() {
        if (currentMessage) {
            result.push(currentMessage);
        }
    }

    for (const mes of messages) {
        const trimed = mes.trim();
        const lowered = trimed.toLocaleLowerCase();

        if (lowered === '<start>') {
            add();
            result.push({
                role: 'system',
                content: '[Start a new chat]',
                memo: 'NewChatExample',
            });
            currentMessage = null;
        } else if (
            lowered.startsWith('{{char}}:') ||
            lowered.startsWith('<bot>:') ||
            lowered.startsWith(`${char.name}:`)
        ) {
            add();
            currentMessage = {
                role: 'assistant',
                content: trimed.split(':', 2)[1].trimStart(),
                name: 'example_assistant',
            };
        } else if (lowered.startsWith('{{user}}:') || lowered.startsWith('<user>:')) {
            add();
            currentMessage = {
                role: 'user',
                content: trimed.split(':', 2)[1].trimStart(),
                name: 'example_user',
            };
        } else {
            if (currentMessage) {
                currentMessage.content += '\n' + trimed;
            }
        }
    }
    add();

    // Parse with risuChatParser
    // TODO: Import risuChatParser from server-side parser module
    // For now, using temporary import from client-side
    const { risuChatParser } = require('../../ts/process/scripts');
    
    result = result.map((r) => {
        return {
            role: r.role,
            content: risuChatParser(r.content, { chara: char }),
            name: r.name,
            memo: r.memo,
        };
    });

    return result;
}
