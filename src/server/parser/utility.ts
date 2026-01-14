/**
 * Parser 유틸리티 함수들
 * risuUnescape, risuEscape, getDistance, trimmer
 */

const replacements = [
    '{', //0xE9B8
    '}', //0xE9B9
    '(', //0xE9BA
    ')', //0xE9BB
    '&lt;', //0xE9BC
    '&gt;', //0xE9BD
    ':', //0xE9BE
    ';', //0xE9BF
]

export function risuUnescape(text: string) {
    return text.replace(/[\uE9b8-\uE9bf]/g, (f) => {
        const index = f.charCodeAt(0) - 0xE9B8
        return replacements[index]
    })
}

export function risuEscape(text: string) {
    return text.replace(/[{}()]/g, (f) => {
        switch (f) {
            case '{': return '\uE9B8'
            case '}': return '\uE9B9'
            case '(': return '\uE9BA'
            case ')': return '\uE9BB'
            default: return f
        }
    })
}

// Levenshtein distance, optimized with 1d array
export function getDistance(a: string, b: string) {
    const h = a.length + 1
    const w = b.length + 1
    let d = new Int16Array(h * w)
    for (let i = 0; i < h; i++) {
        d[i * w] = i
    }
    for (let i = 0; i < w; i++) {
        d[i] = i
    }
    for (let i = 1; i < h; i++) {
        for (let j = 1; j < w; j++) {
            d[i * w + j] = Math.min(
                d[(i - 1) * w + j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1),
                d[(i - 1) * w + j] + 1, d[i * w + j - 1] + 1
            )
        }
    }
    return d[h * w - 1]
}

export function trimmer(str: string) {
    const ext = ['webp', 'png', 'jpg', 'jpeg', 'gif', 'mp4', 'webm', 'avi', 'm4p', 'm4v', 'mp3', 'wav', 'ogg']
    for (const e of ext) {
        if (str.endsWith('.' + e)) {
            str = str.substring(0, str.length - e.length - 1)
        }
    }

    return str.trim().replace(/[_ -.]/g, '')
}

export function parseArray(p1: string): unknown[] {
    try {
        const arr = JSON.parse(p1)
        if (Array.isArray(arr)) {
            return arr
        }
        return p1.split('§')
    } catch (error) {
        return p1.split('§')
    }
}

export function parseDict(p1: string): { [key: string]: unknown } {
    try {
        return JSON.parse(p1)
    } catch (error) {
        return {}
    }
}

export function makeArray(p1: unknown[]): string {
    return JSON.stringify(p1.map((f) => {
        if (typeof (f) === 'string') {
            return f.replace(/::/g, '\\u003A\\u003A')
        }
        return f
    }))
}

export function trimLines(p1: string) {
    return p1.split('\n').map((v) => {
        return v.trimStart()
    }).join('\n').trim()
}
