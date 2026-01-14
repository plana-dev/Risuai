/**
 * CBS 표시 관련 함수들
 */

import type { CBSRegisterArg } from './types';

export function registerDisplayFunctions(arg: CBSRegisterArg) {
    const { registerFunction } = arg;

    registerFunction({
        name: 'button',
        callback: (str, matcherArg, args, vars) => {
            return `<button class="button-default" risu-trigger="${args[1]}">${args[0]}</button>`
        },
        alias: [],
        description: 'Creates an HTML button element with specified text and trigger action. When clicked, executes the trigger command. Returns HTML button markup.\n\nUsage:: {{button::Click Me::trigger_command}}',
    });

    registerFunction({
        name: 'risu',
        callback: (str, matcherArg, args, vars) => {
            const size = args[0] || '45'
            return `<img src="/logo2.png" style="height:${size}px;width:${size}px" />`
        },
        alias: [],
        description: 'Displays the Risuai logo image with specified size in pixels. Default size is 45px if no argument provided. Returns HTML img element.\n\nUsage:: {{risu}} or {{risu::60}}',
    });

    registerFunction({
        name: 'comment',
        callback: (str, matcherArg, args, vars) => {
            if(!matcherArg.displaying){
                return ''
            }
            return `<div class="risu-comment">${args[0]}</div>`
        },
        alias: [],
        description: 'A comment CBS for commenting out code. unlike {{//}}, this one is displayed in the chat.\n\nUsage:: {{comment::this is a comment}}',
    })

    registerFunction({
        name: 'tex',
        callback: (str, matcherArg, args, vars) => {
            return `$$${args[0]}$$`
        },
        alias: ['latex', 'katex'],
        description: 'Renders LaTeX math expressions. Wraps the input in double dollar signs for display.\n\nUsage:: {{tex::E=mc^2}}',
    })

    registerFunction({
        name: 'ruby',
        callback: (str, matcherArg, args, vars) => {
            return `<ruby>${args[0]}<rp> (</rp><rt>${args[1]}</rt><rp>) </rp></ruby>`
        },
        alias: ['furigana'],
        description: 'Renders ruby text (furigana) for East Asian typography. Wraps base text and ruby text in appropriate HTML tags.\n\nUsage:: {{ruby::漢字::かんじ}}',
    })

    registerFunction({
        name: 'codeblock',
        callback: (str, matcherArg, args, vars) => {
            let code = args[args.length - 1]
                .replace(/\"/g, '&quot;')
                .replace(/\'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')

            if(args.length > 1){
                return `<pre-hljs-placeholder lang="${args[0]}">`+ code +'</pre-hljs-placeholder>'
            }

            return `<pre><code>${code}</code></pre>`
        },
        alias: [],
        description: 'Formats text as a code block using HTML pre and code tags.\n\nUsage:: {{codeblock::some code here}}, or {{codeblock::language::some code here}} for syntax highlighting.',
    })

    registerFunction({
        name: 'bkspc',
        callback: (str, matcherArg, args, vars) => {
            let root = matcherArg?.getNested?.()?.[0]
            if(!root){
                return ''
            }
            root = root.trimEnd()

            let trimPointer = root.length - 1

            for(;trimPointer >= 0;trimPointer--){
                const char = root[trimPointer]
                if(trimPointer === 0){
                    break
                }
                if(char === ' ' || char === '\n' || char === '\t'){
                    break
                }
            }

            if(trimPointer === -1){
                trimPointer = 0
            }
            
            matcherArg?.setNestedRoot(root.substring(0, trimPointer).trimEnd())
            return ''
        },
        alias: [],
        description: "Performs a backspace operation, removing the last word from the current output. Useful for correcting or modifying generated text dynamically.\n\nUsage:: hello world {{bkspc}} user → hello user",
    })

    registerFunction({
        name: 'erase',
        callback: (str, matcherArg, args, vars) => {
            let root = matcherArg?.getNested?.()?.[0]
            if(!root){
                return ''
            }
            root = root.trimEnd()

            let trimPointer = root.length - 1
            let sentenceEndFound = false

            for(;trimPointer >= 0;trimPointer--){
                const char = root[trimPointer]
                if(char === '.' || char === '!' || char === '?' || char === '\n'){
                    sentenceEndFound = true
                    break
                }
                if(trimPointer === 0){
                    break
                }
            }

            if(trimPointer === -1){
                trimPointer = 0
            }
            else if(sentenceEndFound){
                trimPointer += 1
            }
            matcherArg?.setNestedRoot(root.substring(0, trimPointer).trimEnd())
            return ''
        },
        alias: [],
        description: "performs a backspace operation, removing the last sentence from the current output. Useful for correcting or modifying generated text dynamically.\n\nUsage:: hello world. what's in {{erase}} what's up → hello world. what's up",
    })

    // Escape characters
    registerFunction({
        name: 'cbr',
        callback: (str, matcherArg, args, vars) => {
            if(args.length > 0){
                return str.repeat(Number(args[0]) < 1 ? 1 : Number(args[0]))
            }
            return '\\n'
        },
        alias: ['cnl', 'cnewline'],
        description: 'Returns an escaped newline character (\\\\n). With optional numeric argument, repeats the character that many times (minimum 1).\n\nUsage:: {{cbr}} or {{cbr::3}}',
    });

    registerFunction({
        name: 'decbo',
        callback: (str, matcherArg, args, vars) => {
            return '\uE9b8'
        },
        alias: ['displayescapedcurlybracketopen'],
        description: 'Returns a special Unicode character that displays as an opening curly bracket { but won\'t be parsed as CBS syntax. Used to display literal braces in output.\n\nUsage:: {{decbo}}',
    });

    registerFunction({
        name: 'decbc',
        callback: (str, matcherArg, args, vars) => {
            return '\uE9b9'
        },
        alias: ['displayescapedcurlybracketclose'],
        description: 'Returns a special Unicode character that displays as a closing curly bracket } but won\'t be parsed as CBS syntax. Used to display literal braces in output.\n\nUsage:: {{decbc}}',
    });

    registerFunction({
        name: 'bo',
        callback: (str, matcherArg, args, vars) => {
            return '\uE9b8\uE9b8'
        },
        alias: ['ddecbo', 'doubledisplayescapedcurlybracketopen'],
        description: 'Returns two special Unicode characters that display as opening double curly brackets {{ but won\'t be parsed as CBS syntax. Used to display literal CBS syntax.\n\nUsage:: {{bo}}',
    });

    registerFunction({
        name: 'bc',
        callback: (str, matcherArg, args, vars) => {
            return '\uE9b9\uE9b9'
        },
        alias: ['ddecbc', 'doubledisplayescapedcurlybracketclose'],
        description: 'Returns two special Unicode characters that display as closing double curly brackets }} but won\'t be parsed as CBS syntax. Used to display literal CBS syntax.\n\nUsage:: {{bc}}',
    });

    registerFunction({
        name: 'displayescapedbracketopen',
        callback: (str, matcherArg, args, vars) => {
            return '\uE9BA'
        },
        alias: ['debo', '('],
        description: 'Returns a special Unicode character that displays as an opening parenthesis ( but won\'t interfere with parsing. Used for literal parentheses in output.\n\nUsage:: {{displayescapedbracketopen}}',
    });

    registerFunction({
        name: 'displayescapedbracketclose',
        callback: (str, matcherArg, args, vars) => {
            return '\uE9BB'
        },
        alias: ['debc', ')'],
        description: 'Returns a special Unicode character that displays as a closing parenthesis ) but won\'t interfere with parsing. Used for literal parentheses in output.\n\nUsage:: {{displayescapedbracketclose}}',
    });

    registerFunction({
        name: 'displayescapedanglebracketopen',
        callback: (str, matcherArg, args, vars) => {
            return '\uE9BC'
        },
        alias: ['deabo', '<'],
        description: 'Returns a special Unicode character that displays as an opening angle bracket < but won\'t interfere with HTML parsing. Used for literal angle brackets.\n\nUsage:: {{displayescapedanglebracketopen}}',
    });

    registerFunction({
        name: 'displayescapedanglebracketclose',
        callback: (str, matcherArg, args, vars) => {
            return '\uE9BD'
        },
        alias: ['deabc', '>'],
        description: 'Returns a special Unicode character that displays as a closing angle bracket > but won\'t interfere with HTML parsing. Used for literal angle brackets.\n\nUsage:: {{displayescapedanglebracketclose}}',
    });

    registerFunction({
        name: 'displayescapedcolon',
        callback: (str, matcherArg, args, vars) => {
            return '\uE9BE'
        },
        alias: ['dec', ':'],
        description: 'Returns a special Unicode character that displays as a colon : but won\'t be parsed as CBS argument separator. Used for literal colons in output.\n\nUsage:: {{displayescapedcolon}}',
    });

    registerFunction({
        name: 'displayescapedsemicolon',
        callback: (str, matcherArg, args, vars) => {
            return '\uE9BF'
        },
        alias: [';'],
        description: 'Returns a special Unicode character that displays as a semicolon ; but won\'t interfere with parsing. Used for literal semicolons in output.\n\nUsage:: {{displayescapedsemicolon}}',
    });

    registerFunction({
        name: 'chardisplayasset',
        callback: (str, matcherArg, args, vars) => {
            const db = arg.getDatabase()
            const selchar = db.characters[arg.getSelectedCharID()]

            if(!selchar.prebuiltAssetCommand){
                return arg.makeArray([])
            }

            const excludes = selchar.prebuiltAssetExclude ?? []
            const arr = (selchar?.additionalAssets ?? []).filter((f) => {
                return !excludes.includes(f[1])
            })

            return arg.makeArray(arr.map((f) => {
                return f[0]
            }))
        },
        alias: [],
        description: 'Returns a JSON array of character display asset names, filtered by prebuilt asset exclusion settings. Only includes assets not in the exclude list.\n\nUsage:: {{chardisplayasset}}',
    });
}
