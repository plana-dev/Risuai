/**
 * SvelteKit API Route 예제: Asset API
 * POST /api/assets - 파일 업로드
 * GET /api/assets?userId=...&characterId=... - 파일 목록 조회
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { getAssetService } from '../../../server/index.js';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const userId = (locals as any).user?.id;
    if (!userId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const characterId = formData.get('characterId') as string | null;

    if (!file) {
      return json({ error: 'File is required' }, { status: 400 });
    }

    const asset = getAssetService();
    const fileData = Buffer.from(await file.arrayBuffer());

    const result = await asset.uploadFile(
      userId,
      characterId,
      fileData,
      file.name,
      file.type
    );

    return json({ success: true, data: result });
  } catch (error) {
    console.error('[API] Error uploading file:', error);
    return json({ error: 'Failed to upload file' }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ request, locals }) => {
  try {
    const userId = (locals as any).user?.id;
    if (!userId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const characterId = url.searchParams.get('characterId');

    const asset = getAssetService();
    const files = await asset.listFiles(userId, characterId);

    return json({ success: true, data: files });
  } catch (error) {
    console.error('[API] Error listing files:', error);
    return json({ error: 'Failed to list files' }, { status: 500 });
  }
};
