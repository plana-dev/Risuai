/**
 * CBS 에셋 관련 함수들 (doc_only)
 */

import type { CBSRegisterArg } from './types';

export function registerAssetFunctions(arg: CBSRegisterArg) {
    const { registerFunction } = arg;

    registerFunction({
        name: 'asset',
        callback: 'doc_only',
        alias: [],
        description: 'Displays additional asset A as appropriate element type.\n\nUsage:: {{asset::assetName}}',
    });

    registerFunction({
        name: 'emotion',
        callback: 'doc_only',
        alias: [],
        description: 'Displays emotion image A as image element.\n\nUsage:: {{emotion::emotionName}}',
    });

    registerFunction({
        name: 'audio',
        callback: 'doc_only',
        alias: [],
        description: 'Displays audio asset A as audio element.\n\nUsage:: {{audio::audioName}}',
    });

    registerFunction({
        name: 'bg',
        callback: 'doc_only',
        alias: [],
        description: 'Displays background image A as background image element.\n\nUsage:: {{bg::backgroundName}}',
    });

    registerFunction({
        name: 'bgm',
        callback: 'doc_only',
        alias: [],
        description: 'Inserts background music control element.\n\nUsage:: {{bgm::musicName}}',
    });

    registerFunction({
        name: 'video',
        callback: 'doc_only',
        alias: [],
        description: 'Displays video asset A as video element.\n\nUsage:: {{video::videoName}}',
    });

    registerFunction({
        name: 'video-img',
        callback: 'doc_only',
        alias: [],
        description: 'Displays video asset A as image-like element.\n\nUsage:: {{video-img::videoName}}',
    });

    registerFunction({
        name: 'image',
        callback: 'doc_only',
        alias: [],
        description: 'Displays image asset A as image element.\n\nUsage:: {{image::imageName}}',
    });

    registerFunction({
        name: 'img',
        callback: 'doc_only',
        alias: [],
        description: 'Displays A as unstyled image element.\n\nUsage:: {{img::imageName}}',
    });

    registerFunction({
        name: 'path',
        callback: 'doc_only',
        alias: ['raw'],
        description: 'Returns additional asset A\'s path data.\n\nUsage:: {{path::assetName}}',
    });

    registerFunction({
        name: 'inlay',
        callback: 'doc_only',
        alias: [],
        description: 'Displays unstyled inlay asset A, which doesn\'t inserts at model request.\n\nUsage:: {{inlay::inlayName}}',
    });

    registerFunction({
        name: 'inlayed',
        callback: 'doc_only',
        alias: [],
        description: 'Displays styled inlay asset A, which doesn\'t inserts at model request.\n\nUsage:: {{inlayed::inlayName}}',
    });

    registerFunction({
        name: 'inlayeddata',
        callback: 'doc_only',
        alias: [],
        description: 'Displays styled inlay asset A, which inserts at model request.\n\nUsage:: {{inlayeddata::inlayName}}',
    });

    registerFunction({
        name: 'source',
        callback: 'doc_only',
        alias: [],
        description: 'Returns the source URL of user or character\'s profile. argument must be "user" or "char".\n\nUsage:: {{source::user}} or {{source::char}}',
    });
}
