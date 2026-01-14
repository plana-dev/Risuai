/**
 * Additional Information 처리
 * 원본: src/ts/process/embedding/addinfo.ts
 * 서버 사이드에서 사용할 수 있도록 개선
 */

import type { character, Chat } from '../../database';
import type { ProcessContext } from '../context';
import { HypaProcessor } from '../memory/hypa-processor';

/**
 * 캐릭터의 additionalText를 사용하여 관련 정보 검색
 */
export async function additionalInformations(
    char: character,
    chats: Chat,
    context: ProcessContext
): Promise<string> {
    const processer = new HypaProcessor(
        'auto',
        undefined,
        context.userId,
        context.chatId,
        context.database
    );

    const info = char.additionalText;
    if (info) {
        const infos = info.split('\n\n');

        await processer.addText(infos);
        const filteredChat = chats.message.slice(0, 4).map((chat) => {
            let name = chat.saying ?? '';

            if (!name) {
                if (chat.role === 'user') {
                    name = context.getUserName();
                } else {
                    name = char.name;
                }
            }

            return `${name}: ${chat.data}`;
        }).join('\n\n');
        const searched = await processer.similaritySearch(filteredChat);
        const result = searched.slice(0, 3).join('\n\n');
        return result;
    }

    return '';
}
