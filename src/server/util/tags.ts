/**
 * 태그 관련 함수들
 * 원본: src/ts/util.ts
 */

export interface TagItem {
    value: string;
    alias: string[];
}

export const TagList: TagItem[] = [
    {
        value: 'female',
        alias: ['feminine', 'girl']
    },
    {
        value: 'male',
        alias: ['masculine', 'boy']
    },
    {
        value: 'OC',
        alias: ['original-character', 'original-characters']
    },
    {
        value: 'game-character',
        alias: ['video_game', 'video-game', 'game', 'video-game-character']
    },
    {
        value: 'anime',
        alias: ['animation', 'anime-character']
    },
    {
        value: 'v-tuber',
        alias: ['virtual-tuber', 'virtual-youtuber', 'virtual-youtube']
    },
    {
        value: 'fantasy',
        alias: ['mystical']
    },
    {
        value: 'religious',
        alias: ['spiritual', 'faith', 'religion', 'religious-character']
    },
    {
        value: 'comedy',
        alias: ['funny', 'humor', 'humorous']
    },
    {
        value: 'mystery',
        alias: ['mysterious', 'enigma']
    },
    {
        value: 'romance',
        alias: ['love', 'lovers', 'couple']
    },
    {
        value: 'dominance',
        alias: ['dominant', 'dom', 'submissive', 'sub', 'bdsm']
    },
    {
        value: 'yandere',
        alias: ['yan', 'yandere-character']
    },
    {
        value: 'non-character',
        alias: ['not-a-character', 'noncharacter', 'non-characters']
    },
    {
        value: 'simulator',
        alias: ['simulation', 'sim']
    },
    {
        value: 'minor',
        alias: ['underage', 'young']
    },
    {
        value: 'giant',
        alias: ['giantess', 'giant-character']
    },
    {
        value: 'tiny',
        alias: ['tiny-character', 'tiny-characters']
    },
    {
        value: 'realistic',
        alias: ['real', 'real-life']
    },
    {
        value: 'cartoon',
        alias: ['toon', 'animated']
    },
    {
        value: 'furry',
        alias: ['anthropomorphic']
    },
    {
        value: 'kenomimi',
        alias: ['animal-ears']
    },
    {
        value: 'mecha',
        alias: ['robot', 'mech']
    },
    {
        value: 'monster',
        alias: ['creature', 'beast', 'monstrous']
    },
    {
        value: 'alien',
        alias: ['extraterrestrial', 'alien-character']
    },
    {
        value: 'demon',
        alias: ['devil', 'demonic', 'demon-character']
    },
    {
        value: 'angel',
        alias: ['heavenly', 'angelic', 'angel-character']
    },
    {
        value: 'elf',
        alias: ['elven', 'elf-character']
    },
    {
        value: 'mermaid',
        alias: ['merfolk', 'mermaid-character']
    },
    {
        value: 'vampire',
        alias: ['vampiric', 'vampire-character']
    },
    {
        value: 'werewolf',
        alias: ['lycan', 'lycanthrope', 'werewolf-character']
    },
    {
        value: 'zombie',
        alias: ['undead', 'zombie-character']
    },
    {
        value: 'ghost',
        alias: ['spirit', 'apparition', 'ghost-character']
    },
    {
        value: 'witch',
        alias: ['sorceress', 'witch-character']
    },
    {
        value: 'wizard',
        alias: ['sorcerer', 'wizard-character']
    },
    {
        value: 'ninja',
        alias: ['shinobi', 'ninja-character']
    },
    {
        value: 'pirate',
        alias: ['buccaneer', 'pirate-character']
    },
    {
        value: 'knight',
        alias: ['paladin', 'knight-character']
    },
    {
        value: 'samurai',
        alias: ['bushi', 'samurai-character']
    },
    {
        value: 'cowboy',
        alias: ['cowgirl', 'cowboy-character']
    },
    {
        value: 'noble',
        alias: ['royal', 'nobility', 'noble-character']
    },
    {
        value: 'thief',
        alias: ['rogue', 'thief-character']
    },
    {
        value: 'spy',
        alias: ['secret-agent', 'spy-character']
    },
    {
        value: 'soldier',
        alias: ['military', 'soldier-character']
    },
    {
        value: 'villain',
        alias: ['antagonist', 'villain-character']
    },
    {
        value: 'hero',
        alias: ['protagonist', 'hero-character']
    },
    {
        value: 'superhero',
        alias: ['super-hero', 'super-heroine', 'superhero-character']
    },
    {
        value: 'mage',
        alias: ['magician', 'mage-character', 'magical']
    },
    {
        value: 'animal',
        alias: ['pet', 'pet-character']
    },
    {
        value: 'cute',
        alias: ['adorable', 'cute-character']
    },
    {
        value: 'nonbinary',
        alias: ['genderqueer', 'genderfluid']
    },
    {
        value: 'multiple-characters',
        alias: ['group', 'multiple']
    },
    {
        value: 'rpg',
        alias: ['roleplaying', 'role-playing']
    },
    {
        value: 'non-human',
        alias: ['inhuman', 'nonhuman', 'non-human-character', 'not-human']
    }
];

/**
 * 태그 검색
 */
export function searchTagList(query: string): string[] {
    const splited = query.split(',').map(v => v.trim());
    if (splited.length > 10) {
        return [];
    }
    const realQuery = splited.at(-1)?.trim().toLowerCase() || '';

    const result: string[] = [];

    for (const tag of TagList) {
        if (tag.value.startsWith(realQuery)) {
            result.push(tag.value);
            continue;
        }
        for (const alias of tag.alias) {
            if (alias.startsWith(realQuery)) {
                result.push(tag.value);
                break;
            }
        }
    }

    return result.filter(v => splited.indexOf(v) === -1);
}
