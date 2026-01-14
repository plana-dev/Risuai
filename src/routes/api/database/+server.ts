/**
 * SvelteKit API Route 예제: Database API
 * GET /api/database - 사용자 데이터 로드
 * POST /api/database - 사용자 데이터 저장
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { getDatabaseAdapter } from '../../../server/index.js';

export const GET: RequestHandler = async ({ request, locals }) => {
  try {
    // 인증 확인 (예시)
    const userId = (locals as any).user?.id; // SvelteKit hooks에서 설정된 사용자 정보
    if (!userId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDatabaseAdapter();
    const database = await db.loadUserDatabase(userId);

    return json({ success: true, data: database });
  } catch (error) {
    console.error('[API] Error loading database:', error);
    return json({ error: 'Failed to load database' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const userId = (locals as any).user?.id;
    if (!userId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const database = body.data;

    if (!database) {
      return json({ error: 'Database data is required' }, { status: 400 });
    }

    const db = getDatabaseAdapter();
    await db.saveUserDatabase(userId, database);

    return json({ success: true });
  } catch (error) {
    console.error('[API] Error saving database:', error);
    return json({ error: 'Failed to save database' }, { status: 500 });
  }
};
