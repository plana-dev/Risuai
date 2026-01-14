/**
 * 스타일 인코딩/디코딩 관련 함수들
 */

import css, { type CssAtRuleAST } from '@adobe/css-tools';
import type { RisuChatParserArg } from './types';

const styleRegex = /\<style\>(.+?)\<\/style\>/gms
const styleDecodeRegex = /\<risu-style\>(.+?)\<\/risu-style\>/gms

export function encodeStyle(txt: string) {
    return txt.replaceAll(styleRegex, (f, c1) => {
        return "<risu-style>" + Buffer.from(c1).toString('hex') + "</risu-style>"
    })
}

function decodeStyleRule(rule: CssAtRuleAST) {
    if (rule.type === 'rule') {
        if (rule.selectors) {
            for (let i = 0; i < rule.selectors.length; i++) {
                let slt: string = rule.selectors[i]
                if (slt) {
                    let selectors = (slt.split(' ') ?? []).map((v) => {
                        if (v.startsWith('.') && !v.startsWith('.x-risu-')) {
                            return ".x-risu-" + v.substring(1)
                        }
                        return v
                    }).join(' ')

                    rule.selectors[i] = ".chattext " + selectors
                }
            }
        }
    }
    if (rule.type === 'media' || rule.type === 'supports' || rule.type === 'document' || rule.type === 'host' || rule.type === 'container') {
        for (let i = 0; i < rule.rules.length; i++) {
            rule.rules[i] = decodeStyleRule(rule.rules[i])
        }
    }
    if (rule.type === 'import') {
        if (rule.import.startsWith('data:')) {
            rule.import = 'data:,'
        }
    }
    return rule
}

export function decodeStyle(
    text: string,
    risuChatParser: (text: string, arg?: RisuChatParserArg) => string,
    returnCSSError?: boolean
) {
    return text.replaceAll(styleDecodeRegex, (full, txt: string) => {
        try {
            let text = Buffer.from(txt, 'hex').toString('utf-8')
            text = risuChatParser(text)
            const ast = css.parse(text)
            const rules = ast?.stylesheet?.rules
            if (rules) {
                for (let i = 0; i < rules.length; i++) {
                    rules[i] = decodeStyleRule(rules[i])
                }
                ast.stylesheet.rules = rules
            }
            return `<style>${css.stringify(ast, {
                indent: '',
                compress: true,
            })}</style>`

        } catch (error) {
            if (returnCSSError) {
                return `CSS ERROR: ${error}`
            }
            return ""
        }
    })
}
