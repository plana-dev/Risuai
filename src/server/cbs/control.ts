/**
 * CBS 제어 구조 함수들 (doc_only)
 */

import type { CBSRegisterArg } from './types';

export function registerControlFunctions(arg: CBSRegisterArg) {
    const { registerFunction } = arg;

    registerFunction({
        name:"#if",
        callback: 'doc_only',
        alias: [],
        description: 'Conditional statement for CBS. 1 and "true" are truty, and otherwise false.\n\nUsage:: {{#if condition}}...{{/if}}.',
        deprecated: {
            message: 'Due to limitations of adding operators, #if is deprecated and replaced with #when. Use #when instead.',
            replacement: '#when',
        }
    })

    registerFunction({
        name:'#if_pure',
        callback: 'doc_only',
        alias: [],
        description: 'Conditional statement for CBS, which has keep whitespace handling. 1 and "true" are truty, and otherwise false.\n\nUsage:: {{#if_pure condition}}...{{/if_pure}}',
        deprecated: {
            message: 'Due to limitations of adding operators, #if_pure is deprecated and replaced with #when with keep operator. Use #when::keep::condition instead.',
            replacement: '#when',
        }
    })

    registerFunction({
        name:'#when',
        callback: 'doc_only',
        alias: [],
        description: `Conditional statement for CBS. 1 and "true" are truty, and otherwise false.

It can add operators to condition:

Basic operators:
{{#when::A::and::B}}...{{/when}} - checks if both conditions are true.
{{#when::A::or::B}}...{{/when}} - checks if at least one condition is true.
{{#when::A::is::B}}...{{/when}} - checks if A is equal to B.
{{#when::A::isnot::B}}...{{/when}} - checks if A is not equal to B.
{{#when::A::>::B}}...{{/when}} - checks if A is greater than B.
{{#when::A::<::B}}...{{/when}} - checks if A is less than B.
{{#when::A::>=::B}}...{{/when}} - checks if A is greater than or equal to B.
{{#when::A::<=::B}}...{{/when}} - checks if A is less than or equal to B.
{{#when::not::A}}...{{/when}} - negates condition, so it will be true if A is false.

Advanced operators:
{{#when::keep::A}}...{{/when}} - keep whitespace handling, so it will not trim spaces inside block.
{{#when::legacy::A}}...{{/when}} - legacy whitespace handling, so it will handle like deprecated #if.
{{#when::var::A}}...{{/when}} - checks if variable A is truthy.
{{#when::A::vis::B}}...{{/when}} - checks if variable A is equal to literal B.
{{#when::A::visnot::B}}...{{/when}} - checks if variable A is not equal to literal B.
{{#when::toggle::togglename}}...{{/when}} - checks if toggle is enabled.
{{#when::A::tis::B}}...{{/when}} - checks if toggle A is equal to literal B.
{{#when::A::tisnot::B}}...{{/when}} - checks if toggle A is not equal to literal B.

operators can be combined like:
{{#when::keep::not::condition}}...{{/when}}
{{#when::keep::condition1::and::condition2}}...{{/when}}

You can use whitespace instead of "::" if there is no operators, like:
{{#when condition}}...{{/when}}

Usage:: {{#when condition}}...{{/when}} or {{#when::not::condition}}...{{/when}}
`,
    })

    registerFunction({
        name:':else',
        callback: 'doc_only',
        alias: [],
        description: 'Else statement for CBS. Must be used inside {{#when}}. if {{#when}} is multiline, :else must be on line without additional string. if {{#when}} is used with operator \'legacy\', it will not work.\n\nUsage:: {{#when condition}}...{{:else}}...{{/when}} or {{#when::not::condition}}...{{:else}}...{{/when}}',
    })

    registerFunction({
        name:'#pure',
        callback: 'doc_only',
        alias: [],
        description: 'displays content without any CBS processing. Useful for displaying raw HTML or other content without parsing.\n\nUsage:: {{#puredisplay}}...{{/puredisplay}}',
        deprecated: {
            message: 'Due to reparsing issue, #pure is deprecated and replaced with #puredisplay. Use #puredisplay instead.',
            replacement: '#puredisplay',
        }
    })
    
    registerFunction({
        name:'#puredisplay',
        callback: 'doc_only',
        alias: [],
        description: 'displays content without any CBS processing. Useful for displaying raw HTML or other content without parsing.\n\nUsage:: {{#puredisplay}}...{{/puredisplay}}',
    })

    registerFunction({
        name:'#each',
        callback: 'doc_only',
        alias: [':each'],
        description: `Iterates over an array.

Operators:
{{#each::keep A as V}} - keep whitespace handling, so it will not trim spaces inside block.

Usage:: {{#each A as V}} ... {{slot::V}} ... {{/each}}`,
    })

    registerFunction({
        name: 'slot',
        callback: 'doc_only',
        alias: [],
        description: 'Used in various CBS functions to access specific slots or properties.\n\nUsage:: {{slot::propertyName}} or {{slot}}, depending on context.',
    })

    registerFunction({
        name: 'position',
        callback: 'doc_only',
        alias: [],
        description: 'Defines the position which can be used in various features such as @@position <positionName> decorator.\n\nUsage:: {{position::positionName}}',
    })

    registerFunction({
        name: '//',
        callback: 'doc_only',
        alias: [],
        description: 'A comment CBS for commenting out code.\n\nUsage:: {{// this is a comment}}',
    })

    registerFunction({
        name: '?',
        callback: 'doc_only',
        alias: [],
        description: 'Runs math operations on numbers. Supports +, -, *, /, %, ^ (exponentiation), % (modulo), < (less than), > (greater than), <= (less than or equal), >= (greater than or equal), == (equal), != (not equal), and brackets for grouping.\n\nUsage:: {{? 1+2}} → 3, {{? (2*3)+4}} → 10',
    })

    registerFunction({
        name: '__',
        callback: (str, matcherArg, args, vars) => {
            return arg.callInternalFunction(args)
        },
        alias: [],
        description: '**INTERNAL FUNCTION - DO NOT USE**',
        internalOnly: true,
    });
}
