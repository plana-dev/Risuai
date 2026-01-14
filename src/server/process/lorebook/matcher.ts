/**
 * Lorebook 키워드 매칭 로직
 * 원본: src/ts/process/lorebook.svelte.ts의 searchMatch 함수
 */

import type { Message } from '../../database';
import type { SearchMatchArg, MatchLog, RecursivePrompt } from './types';

/**
 * 메시지에서 키워드 검색 및 매칭
 */
export function searchMatch(
    messages: Message[],
    arg: SearchMatchArg,
    context: {
        username: string;
        findCharacterbyId: (id: string) => { name: string } | null;
        currentCharName: string;
        recursivePrompt?: RecursivePrompt[];
    },
    matchLog: MatchLog[]
): boolean {
    const sliced = messages.slice(messages.length - arg.searchDepth, messages.length);
    arg.keys = arg.keys.map(key => key.trim()).filter(key => key.length > 0);

    let mList: {
        source: string;
        prompt: string;
        data: string;
    }[] = sliced.map((msg, i) => {
        if (msg.role === 'user') {
            return {
                source: `message ${i} by user`,
                prompt: `\x01{{${context.username}}}:` + msg.data + '\x01',
                data: msg.data,
            };
        } else {
            const charName =
                msg.name ??
                (msg.saying ? context.findCharacterbyId(msg.saying)?.name : null) ??
                context.currentCharName;
            return {
                source: `message ${i} by char`,
                prompt: `\x01{{${charName}}}:` + msg.data + '\x01',
                data: msg.data,
            };
        }
    }).concat(
        arg.dontSearchWhenRecursive
            ? []
            : (context.recursivePrompt || []).map(msg => {
                  return {
                      source: 'lorebook ' + msg.source,
                      prompt: msg.prompt,
                      data: msg.data,
                  };
              })
    );

    // Regex 매칭
    if (arg.regex) {
        for (const mText of mList) {
            for (const regexString of arg.keys) {
                if (!regexString.startsWith('/')) {
                    return false;
                }
                const regexFlag = regexString.split('/').pop();
                if (regexFlag) {
                    const regexPattern = regexString.replace('/' + regexFlag, '');
                    try {
                        const regex = new RegExp(regexPattern, regexFlag);
                        const d = regex.test(mText.data);
                        if (d) {
                            matchLog.push({
                                prompt: mText.prompt,
                                source: mText.source,
                                activated: regexString,
                            });
                            return true;
                        }
                    } catch (error) {
                        return false;
                    }
                }
            }
        }
        return false;
    }

    // 일반 텍스트 매칭
    mList = mList.map(m => {
        return {
            source: m.source,
            prompt: m.prompt
                .toLocaleLowerCase()
                .replace(/\{\{\/\/(.+?)\}\}/g, '')
                .replace(/\{\{comment:(.+?)\}\}/g, ''),
            data: m.data
                .toLocaleLowerCase()
                .replace(/\{\{\/\/(.+?)\}\}/g, '')
                .replace(/\{\{comment:(.+?)\}\}/g, ''),
        };
    });

    let allMode = arg.all ?? false;
    let allModeMatched = true;

    for (const m of mList) {
        let mText = m.data;
        if (arg.fullWordMatching) {
            const splited = mText.split(' ');
            for (const key of arg.keys) {
                if (splited.includes(key.toLocaleLowerCase())) {
                    matchLog.push({
                        prompt: m.prompt,
                        source: m.source,
                        activated: key,
                    });
                    if (!allMode) {
                        return true;
                    }
                } else if (allMode) {
                    allModeMatched = false;
                }
            }
        } else {
            mText = mText.replace(/ /g, '');
            for (const key of arg.keys) {
                const realKey = key.toLocaleLowerCase().replace(/ /g, '');
                if (mText.includes(realKey)) {
                    matchLog.push({
                        prompt: m.prompt,
                        source: m.source,
                        activated: key,
                    });
                    if (!allMode) {
                        return true;
                    }
                } else if (allMode) {
                    allModeMatched = false;
                }
            }
        }
    }

    if (allMode && allModeMatched) {
        return true;
    }
    return false;
}
