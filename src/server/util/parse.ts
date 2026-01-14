/**
 * 파싱 관련 함수들
 * 원본: src/ts/util.ts
 */

export type sidebarToggleGroup = {
    key?: string;
    value?: string;
    type: 'group';
    children: sidebarToggle[];
};

export type sidebarToggleGroupEnd = {
    key?: string;
    value?: string;
    type: 'groupEnd';
};

export type sidebarToggle =
    | sidebarToggleGroup
    | sidebarToggleGroupEnd
    | {
        key?: string;
        value?: string;
        type: 'divider';
    }
    | {
        key: string;
        value: string;
        type: 'select';
        options: string[];
    }
    | {
        key: string;
        value: string;
        type: 'text' | undefined;
        options?: string[];
    };

/**
 * 키-값 형식의 템플릿 파싱
 */
export function parseKeyValue(template: string): [string, string][] {
    try {
        if (!template) {
            return [];
        }

        const keyValue: [string, string][] = [];

        for (const line of template.split('\n')) {
            const [key, value] = line.split('=');
            if (key && value) {
                keyValue.push([key, value]);
            }
        }

        return keyValue;
    } catch (error) {
        return [];
    }
}

/**
 * 토글 문법 파싱
 */
export function parseToggleSyntax(template: string): sidebarToggle[] {
    try {
        if (!template) {
            return [];
        }

        const keyValue: sidebarToggle[] = [];

        const splited = template.split('\n');

        for (const line of splited) {
            const [key, value, type, option] = line.split('=');
            if (type === 'group' || type === 'groupEnd' || type === 'divider') {
                keyValue.push({
                    key,
                    value,
                    type: type as 'group' | 'groupEnd' | 'divider',
                    children: []
                } as sidebarToggle);
            } else if ((key && value)) {
                keyValue.push({
                    key,
                    value,
                    type: type === 'select' || type === 'text' ? type : undefined,
                    options: option?.split(',') ?? []
                } as sidebarToggle);
            }
        }

        return keyValue;
    } catch (error) {
        console.error(error);
        return [];
    }
}
