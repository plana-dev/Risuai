/**
 * Markdown 렌더링 관련 함수들
 * renderMarkdown, renderHighlightableMarkdown
 * 
 * 주의: 이 모듈은 클라이언트 전용 기능(DOMPurify, highlight.js 등)을 포함하므로
 * 서버 사이드에서는 제한적으로 사용하거나 인터페이스로 추상화 필요
 */

import type markdownit from 'markdown-it';
import katex from 'katex';
import { risuUnescape } from './utility';

export interface MarkdownContext {
    getDatabase: () => {
        customQuotes?: boolean;
        customQuotesData?: string[];
        unformatQuotes?: boolean;
    };
    md: markdownit;
    mdHighlight: markdownit;
    hljs?: any; // highlight.js (클라이언트 전용)
    language?: {
        error: string;
    };
}

export function renderMarkdown(
    md: markdownit,
    data: string,
    context: MarkdownContext
): string {
    let quotes = ['"', '"', ''', ''']
    if (context.getDatabase()?.customQuotes) {
        quotes = context.getDatabase().customQuotesData ?? quotes
    }
    data = data.replace(/\$\$(.*?)\$\$/gs, (
        match: string,
        content: string,
    ) => {

        try {
            content = content
                .replace(/\uE9b8/gu, '{')
                .replace(/\uE9b9/gu, '}')
                .replace(/\uE9ba/gu, '(')
                .replace(/\uE9bb/gu, ')')
            const rendered = katex.renderToString(content, {
                displayMode: false,
                throwOnError: true,
                output: 'mathml'
            })
            return rendered
        } catch (error) {
            console.error('KaTeX render error:', error)
            return match
        }
    })
    let text = risuUnescape(md.render(data.replace(/"|"/g, '"').replace(/'|'/g, "'")))

    if (context.getDatabase()?.unformatQuotes) {
        text = text.replace(/\uE9b0/gu, quotes[0]).replace(/\uE9b1/gu, quotes[1])
        text = text.replace(/\uE9b2/gu, quotes[2]).replace(/\uE9b3/gu, quotes[3])
    }
    else {
        text = text.replace(/\uE9b0/gu, '<mark risu-mark="quote2">' + quotes[0]).replace(/\uE9b1/gu, quotes[1] + '</mark>')
        text = text.replace(/\uE9b2/gu, '<mark risu-mark="quote1">' + quotes[2]).replace(/\uE9b3/gu, quotes[3] + '</mark>')
    }

    return text
}

export async function renderHighlightableMarkdown(
    data: string,
    context: MarkdownContext
): Promise<string> {
    let rendered = renderMarkdown(context.mdHighlight, data, context)
    const highlightPlaceholders = rendered.match(/<pre-hljs-placeholder lang="(.+?)">(.+?)<\/pre-hljs-placeholder>/gms)
    if (!highlightPlaceholders || !context.hljs) {
        return rendered
    }

    for (const placeholder of highlightPlaceholders) {
        try {
            let lang = placeholder.match(/lang="(.+?)"/)?.[1]
            const code = placeholder.match(/<pre-hljs-placeholder lang=".+?">(.+?)<\/pre-hljs-placeholder>/ms)?.[1]
            if (!lang || !code) {
                continue
            }

            // 서버 사이드에서는 highlight.js 동적 로딩 제한
            // 클라이언트 전용 기능이므로 기본 렌더링만 수행
            if (lang === 'none') {
                rendered = rendered.replace(placeholder, `<pre><code>${context.mdHighlight.utils.escapeHtml(code)}</code></pre>`)
            }
            else if (lang === 'error') {
                rendered = rendered.replace(placeholder, `<div class="risu-error"><h1>${context.language?.error ?? 'Error'}</h1>${context.mdHighlight.utils.escapeHtml(code)}</div>`)
            }
            else {
                // 서버 사이드에서는 기본 코드 블록으로 렌더링
                rendered = rendered.replace(placeholder, `<pre class="hljs"><code>${context.mdHighlight.utils.escapeHtml(code)}</code></pre>`)
            }
        } catch (error) {
            // 에러 발생 시 기본 렌더링
        }
    }

    return rendered
}
