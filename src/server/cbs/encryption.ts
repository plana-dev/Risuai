/**
 * CBS 암호화 함수들
 */

import type { CBSRegisterArg } from './types';

export function registerEncryptionFunctions(arg: CBSRegisterArg) {
    const { registerFunction } = arg;

    registerFunction({
        name: 'xor',
        callback: (str, matcherArg, args, vars) => {
            const buf = new TextEncoder().encode(args[0])
            for(let i = 0; i < buf.length; i++){
                buf[i] ^= 0xFF
            }
            return Buffer.from(buf).toString('base64')
        },
        alias: ['xorencrypt', 'xorencode', 'xore'],
        description: 'Encrypts a string using XOR cipher with 0xFF key and encodes result as base64. Simple obfuscation method. Reversible with xordecrypt.\n\nUsage:: {{xor::hello}}',
    });

    registerFunction({
        name: 'xordecrypt',
        callback: (str, matcherArg, args, vars) => {
            const buf = Buffer.from(args[0], 'base64')
            for(let i = 0; i < buf.length; i++){
                buf[i] ^= 0xFF
            }
            return new TextDecoder().decode(buf)
        },
        alias: ['xordecode', 'xord'],
        description: 'Decrypts a base64-encoded XOR-encrypted string back to original text. Reverses the xor function using same 0xFF key.\n\nUsage:: {{xordecrypt::base64string}}',
    });

    registerFunction({
        name: 'crypt',
        callback: (str, matcherArg, args, vars) => {
            let shift = args[1] ? Number(args[1]) : 32768
            if(isNaN(shift)){
                shift = 32768
            }

            let result = ''
            for(let i = 0; i < args[0].length; i++){
                const charCode = args[0].charCodeAt(i)
                if(charCode > 65535){
                    result += args[0][i]
                    continue
                }
                let shiftedCode = charCode + shift
                if(shiftedCode > 65535){
                    shiftedCode -= 65536
                }
                result += String.fromCharCode(shiftedCode)
            }
            return result
        },
        alias: ['crypto', 'caesar', 'encrypt', 'decrypt'],
        description: 'Applies Caesar cipher encryption/decryption with custom shift value (default 32768). Shifts Unicode character codes within 16-bit range. By using default shift, it can be used for both encryption and decryption.\n\nUsage:: {{crypt::hello}} or {{crypt::hello::1000}}',
    });
}
