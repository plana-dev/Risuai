/**
 * 메타데이터 관련 함수들
 */

const metaCodes = [
    '\u200B', //zero width space
    '\u200C', //zero width non-joiner
    '\u200D', //zero width joiner
    '\uFEFF', //zero width no-break space
    '\u2060', //word joiner
    '\u180E', //mongolian vowel separator
]

export function addMetadataToElement(data: string, modelShortName: string, aiWatermarkingLawApplies: () => boolean): string {
    if (!aiWatermarkingLawApplies()) {
        return data
    }

    let metadata = '{' + [
        'aigen',
        'risuai',
        modelShortName.toLocaleLowerCase().replace(/[^a-z]/g, ''),
    ].join('|') + '}'
    let encodedMetaCode = ''

    for (let i = 0; i < metadata.length; i++) {
        let byte = (metadata.charCodeAt(i) - 97).toString(6).padStart(2, '0')
        for (let j = 0; j < byte.length; j++) {
            switch (byte.charAt(j)) {
                case '0': {
                    encodedMetaCode += metaCodes[0]
                    break
                }
                case '1': {
                    encodedMetaCode += metaCodes[1]
                    break
                }
                case '2': {
                    encodedMetaCode += metaCodes[2]
                    break
                }
                case '3': {
                    encodedMetaCode += metaCodes[3]
                    break
                }
                case '4': {
                    encodedMetaCode += metaCodes[4]
                    break
                }
                case '5': {
                    encodedMetaCode += metaCodes[5]
                    break
                }
            }
        }
    }

    console.log('Encoded metadata:', encodedMetaCode.length, 'characters')
    console.log('This requires at least', Math.ceil(encodedMetaCode.length / 32), '<p> tags to store')

    let d = data.replace(/\<p\>/g, (v) => {
        return '<p>' + encodedMetaCode
    })

    return d + encodedMetaCode
}

export function parseThoughtsAndTools(data: string, language: { cot: string, toolCalled: string }): string {
    let result = '', i = 0
    while (i < data.length) {
        if (data.slice(i, i + 10) === '<Thoughts>') {
            let j = i + 10, depth = 1
            while (j < data.length && depth > 0) {
                if (data.slice(j, j + 10) === '<Thoughts>') depth++
                if (data.slice(j, j + 11) === '</Thoughts>') depth--
                j++
            }
            if (depth === 0) {
                result += `<details><summary>${language.cot}</summary>${data.substring(i + 10, j - 1)}</details>`
                i = j + 10
                continue
            }
        }
        result += data[i++]
    }
    return result.replace(/<tool_call>(.+?)<\/tool_call>/gms, (full, txt: string) => {
        return `<div class="x-risu-tool-call">🛠️ ${language.toolCalled.replace('{{tool}}', txt.split('\uf100')?.[1] ?? 'unknown')}</div>\n\n`
    })
}
