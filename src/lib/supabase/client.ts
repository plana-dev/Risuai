import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PUBLIC_SUPABASE_SECRET_KEY } from '$env/static/public';

/**
 * Supabase 클라이언트 인스턴스 (서버 사이드용)
 * Service Role Key를 사용하여 RLS를 우회하고 모든 작업을 수행할 수 있습니다.
 */
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_SECRET_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

/**
 * Supabase Storage 버킷이 존재하는지 확인하고 없으면 생성
 */
export async function ensureBucketExists(bucketName: string, isPublic: boolean = true): Promise<void> {
	const { data: buckets, error: listError } = await supabase.storage.listBuckets();
	
	if (listError) {
		throw new Error(`Failed to list buckets: ${listError.message}`);
	}

	const bucketExists = buckets?.some((bucket) => bucket.name === bucketName);

	if (!bucketExists) {
		const { error: createError } = await supabase.storage.createBucket(bucketName, {
			public: isPublic
		});

		if (createError) {
			throw new Error(`Failed to create bucket: ${createError.message}`);
		}
	}
}

