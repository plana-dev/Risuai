/**
 * CBS 비교 함수들
 * equal, notequal, greater, less, greaterequal, lessequal, and, or, not
 */

import type { CBSRegisterArg } from './types';

export function registerComparisonFunctions(arg: CBSRegisterArg) {
    const { registerFunction } = arg;

    registerFunction({
        name: 'equal',
        callback: (str, matcherArg, args, vars) => {
            return (args[0] === args[1]) ? '1' : '0'
        },
        alias: [],
        description: 'Compares two values for exact equality. Returns "1" if values are identical (string comparison), "0" otherwise. Case-sensitive.\n\nUsage:: {{equal::value1::value2}}',
    });

    registerFunction({
        name: 'notequal',
        callback: (str, matcherArg, args, vars) => {
            return (args[0] !== args[1]) ? '1' : '0'
        },
        alias: ['not_equal'],
        description: 'Compares two values for inequality. Returns "1" if values are different (string comparison), "0" if identical. Case-sensitive.\n\nUsage:: {{notequal::value1::value2}}',
    });

    registerFunction({
        name: 'greater',
        callback: (str, matcherArg, args, vars) => {
            return (Number(args[0]) > Number(args[1])) ? '1' : '0'
        },
        alias: [],
        description: 'Compares two numeric values. Returns "1" if first number is greater than second, "0" otherwise. Converts arguments to numbers before comparison.\n\nUsage:: {{greater::10::5}}',
    });

    registerFunction({
        name: 'less',
        callback: (str, matcherArg, args, vars) => {
            return (Number(args[0]) < Number(args[1])) ? '1' : '0'
        },
        alias: [],
        description: 'Compares two numeric values. Returns "1" if first number is less than second, "0" otherwise. Converts arguments to numbers before comparison.\n\nUsage:: {{less::5::10}}',
    });

    registerFunction({
        name: 'greaterequal',
        callback: (str, matcherArg, args, vars) => {
            return (Number(args[0]) >= Number(args[1])) ? '1' : '0'
        },
        alias: ['greater_equal'],
        description: 'Compares two numeric values. Returns "1" if first number is greater than or equal to second, "0" otherwise. Converts arguments to numbers before comparison.\n\nUsage:: {{greaterequal::10::10}}',
    });

    registerFunction({
        name: 'lessequal',
        callback: (str, matcherArg, args, vars) => {
            return (Number(args[0]) <= Number(args[1])) ? '1' : '0'
        },
        alias: ['less_equal'],
        description: 'Compares two numeric values. Returns "1" if first number is less than or equal to second, "0" otherwise. Converts arguments to numbers before comparison.\n\nUsage:: {{lessequal::5::5}}',
    });

    registerFunction({
        name: 'and',
        callback: (str, matcherArg, args, vars) => {
            return args[0] === '1' && args[1] === '1' ? '1' : '0'
        },
        alias: [],
        description: 'Performs logical AND on two boolean values. Returns "1" only if both arguments are "1", otherwise returns "0". Treats any value other than "1" as false.\n\nUsage:: {{and::1::1}}',
    });

    registerFunction({
        name: 'or',
        callback: (str, matcherArg, args, vars) => {
            return args[0] === '1' || args[1] === '1' ? '1' : '0'
        },
        alias: [],
        description: 'Performs logical OR on two boolean values. Returns "1" if either argument is "1", otherwise returns "0". Treats any value other than "1" as false.\n\nUsage:: {{or::1::0}}',
    });

    registerFunction({
        name: 'not',
        callback: (str, matcherArg, args, vars) => {
            return args[0] === '1' ? '0' : '1'
        },
        alias: [],
        description: 'Performs logical NOT on a boolean value. Returns "0" if argument is "1", returns "1" for any other value. Inverts the boolean state.\n\nUsage:: {{not::1}}',
    });
}
