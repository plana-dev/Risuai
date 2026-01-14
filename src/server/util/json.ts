/**
 * JSON 및 스키마 처리 함수들
 * 원본: src/ts/util.ts
 */

/**
 * JSON 출력 정리 (Thoughts 태그 제거 및 코드 블록 제거)
 */
export function jsonOutputTrimmer(data: string): string {
    data = data.replace(/<Thoughts>(.+?)<\/Thoughts>/gms, '').trim();
    if (data.startsWith('```json') && data.endsWith('```')) {
        data = data.slice(7, -3).trim();
    }
    return data.trim();
}

/**
 * 스키마 단순화
 */
export function simplifySchema(schema: any, args: {
    upperType?: boolean;
} = {}): any {
    if (!schema || typeof schema !== 'object') {
        console.error('Schema is not an object', schema);
        return schema;
    }

    if (Array.isArray(schema.type)) {
        if (schema.type.includes('null')) {
            schema.nullable = true;
        }
        schema.type = (schema.type as string[]).filter(v => v !== 'null')[0];
    }

    console.log('schema', schema);
    const result: any = {};

    if (schema.type) {
        result.type = (schema.type as string)?.toLowerCase();
    }
    if (schema.type === 'object') {
        result.properties = {};
        for (const key in schema.properties) {
            result.properties[key] = simplifySchema(schema.properties[key], args);
        }
        if (schema.required && schema.required.length > 0) {
            result.required = schema.required;
        }
    }
    if (schema.type === 'array') {
        result.items = simplifySchema(schema.items, args);
    }

    if (schema.type === 'string' && schema.enum && schema.enum.length > 0) {
        result.enum = schema.enum;
    }

    if (schema.type === 'string' && schema.format) {
        result.format = schema.format;
    }

    if (schema.nullable) {
        result.nullable = true;
    }

    if (schema.maxLength !== undefined && schema.maxLength !== null) {
        result.maxLength = schema.maxLength;
    }

    if (schema.minLength !== undefined && schema.minLength !== null) {
        result.minLength = schema.minLength;
    }

    if (schema.minProperties !== undefined && schema.minProperties !== null) {
        result.minProperties = schema.minProperties;
    }

    if (schema.maxProperties !== undefined && schema.maxProperties !== null) {
        result.maxProperties = schema.maxProperties;
    }

    if (schema.description) {
        result.description = schema.description;
    }

    if (schema.anyOf && schema.anyOf.length > 0) {
        console.log('anyOf', schema.anyOf);
        result.anyOf = schema.anyOf.map((v: any) => simplifySchema(v, args));
    }

    return result;
}

/**
 * 사전 구축된 에셋 명령어 템플릿
 */
export const prebuiltAssetCommand = `
<Image Tag Instruction>Insert HTML image tags between paragraphs based on context.
Set src as keywords from the list below that matches current character, outfit, situation sentiment and etc.
print as many different images as possible. Use only available keywords.
if there are no matching keywords, try to put clostest matching image src.
try to put at least 1 image per output.
<keywords>{{join::{{chardisplayasset}}::,}}</keywords>
Example: <img src="{{ele::{{chardisplayasset}}::0}}">
<Image Tag Instruction>
`;
