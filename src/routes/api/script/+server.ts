/**
 * SvelteKit API Route: Lua Script 실행
 * POST /api/script - Lua 스크립트 실행
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { runServerScript, runLuaEditTrigger, runLuaButtonTrigger, getDatabaseAdapter } from '../../../server/index.js';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const userId = (locals as any).user?.id;
    if (!userId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, userId: bodyUserId, characterId, chatId, code, mode, data, meta } = body;

    const finalUserId = bodyUserId || userId;

    if (!characterId || !chatId) {
      return json({ error: 'characterId and chatId are required' }, { status: 400 });
    }

    switch (action) {
      case 'runScript': {
        if (!code) {
          return json({ error: 'code is required' }, { status: 400 });
        }

        const result = await runServerScript(code, {
          userId: finalUserId,
          characterId,
          chatId,
          data,
          mode: mode || 'manual',
          meta,
        });

        return json({ success: true, data: result });
      }

      case 'runEditTrigger': {
        if (!mode || !data) {
          return json({ error: 'mode and data are required' }, { status: 400 });
        }

        // 캐릭터 로드
        const db = await getDatabaseAdapter().loadUserDatabase(finalUserId);
        const char = db.characters.find((c) => c.chaId === characterId);

        if (!char) {
          return json({ error: 'Character not found' }, { status: 404 });
        }

        const result = await runLuaEditTrigger(
          finalUserId,
          characterId,
          chatId,
          char,
          mode,
          data,
          meta
        );

        return json({ success: true, data: result });
      }

      case 'runButtonTrigger': {
        if (!data) {
          return json({ error: 'data is required' }, { status: 400 });
        }

        // 캐릭터 로드
        const db = await getDatabaseAdapter().loadUserDatabase(finalUserId);
        const char = db.characters.find((c) => c.chaId === characterId);

        if (!char) {
          return json({ error: 'Character not found' }, { status: 404 });
        }

        const result = await runLuaButtonTrigger(finalUserId, characterId, chatId, char, data);

        return json({ success: true, data: result });
      }

      default:
        return json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] Error executing script:', error);
    return json({ error: 'Failed to execute script' }, { status: 500 });
  }
};
