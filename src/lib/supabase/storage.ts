import { supabase, ensureBucketExists } from './client.js';

/**
 * Storage 버킷 이름 상수
 */
export const STORAGE_BUCKETS = {
	CHARACTER_ASSETS: 'character-assets',
	WORLD_ASSETS: 'world-assets',
	USER_ASSETS: 'user-assets'
} as const;

/**
 * base64 데이터 URI를 Buffer로 변환
 * @param dataUri - `data:image/png;base64,...` 형식의 데이터 URI
 * @returns Buffer 객체
 */
export function base64DataUriToBuffer(dataUri: string): Buffer {
	// data URI 형식에서 base64 부분만 추출
	const base64Match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
	if (!base64Match) {
		throw new Error('Invalid data URI format');
	}

	const base64Data = base64Match[2];
	return Buffer.from(base64Data, 'base64');
}

/**
 * base64 문자열을 Buffer로 변환
 * @param base64String - base64 인코딩된 문자열
 * @returns Buffer 객체
 */
export function base64ToBuffer(base64String: string): Buffer {
	return Buffer.from(base64String, 'base64');
}

/**
 * 파일을 Supabase Storage에 업로드
 * @param bucketName - 버킷 이름
 * @param filePath - 저장할 파일 경로 (예: 'characters/icon.png')
 * @param fileData - 파일 데이터 (Buffer, Blob, 또는 File)
 * @param options - 업로드 옵션
 * @returns 업로드된 파일의 public URL
 */
export async function uploadToStorage(
	bucketName: string,
	filePath: string,
	fileData: Buffer | Blob | File,
	options: {
		contentType?: string;
		upsert?: boolean;
		cacheControl?: string;
		ensureBucket?: boolean;
	} = {}
): Promise<{ path: string; publicUrl: string }> {
	const { contentType, upsert = false, cacheControl = '3600', ensureBucket: shouldEnsure = true } = options;

	// 버킷이 존재하는지 확인하고 없으면 생성
	if (shouldEnsure) {
		await ensureBucketExists(bucketName, true);
	}

	// Buffer를 Blob으로 변환 (Supabase Storage는 Blob을 받음)
	let blob: Blob;
	if (Buffer.isBuffer(fileData)) {
		blob = new Blob([fileData], { type: contentType || 'application/octet-stream' });
	} else {
		blob = fileData;
	}

	// 파일 업로드
	const { data, error } = await supabase.storage.from(bucketName).upload(filePath, blob, {
		contentType: contentType,
		upsert,
		cacheControl
	});

	if (error) {
		throw new Error(`Failed to upload file to storage: ${error.message}`);
	}

	// Public URL 생성
	const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);

	return {
		path: data.path,
		publicUrl: urlData.publicUrl
	};
}

/**
 * base64 데이터 URI를 Supabase Storage에 업로드
 * @param bucketName - 버킷 이름
 * @param filePath - 저장할 파일 경로
 * @param dataUri - `data:image/png;base64,...` 형식의 데이터 URI
 * @param options - 업로드 옵션
 * @returns 업로드된 파일의 public URL
 */
export async function uploadBase64DataUriToStorage(
	bucketName: string,
	filePath: string,
	dataUri: string,
	options: {
		upsert?: boolean;
		cacheControl?: string;
	} = {}
): Promise<{ path: string; publicUrl: string }> {
	// MIME 타입 추출
	const mimeMatch = dataUri.match(/^data:([^;]+);base64,/);
	const contentType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

	// base64 데이터를 Buffer로 변환
	const buffer = base64DataUriToBuffer(dataUri);

	// Storage에 업로드
	return uploadToStorage(bucketName, filePath, buffer, {
		contentType,
		...options
	});
}

/**
 * 여러 파일을 병렬로 업로드
 * @param uploads - 업로드할 파일 정보 배열
 * @param concurrency - 동시 업로드 개수 (기본값: 5)
 * @returns 업로드 결과 배열
 */
export async function uploadMultipleFiles(
	uploads: Array<{
		bucketName: string;
		filePath: string;
		fileData: Buffer | Blob | File;
		options?: {
			contentType?: string;
			upsert?: boolean;
			cacheControl?: string;
		};
	}>,
	concurrency: number = 5
): Promise<Array<{ path: string; publicUrl: string } | { error: string }>> {
	const results: Array<{ path: string; publicUrl: string } | { error: string }> = [];

	// 배치로 나누어 처리
	for (let i = 0; i < uploads.length; i += concurrency) {
		const batch = uploads.slice(i, i + concurrency);

		const batchResults = await Promise.allSettled(
			batch.map((upload) =>
				uploadToStorage(upload.bucketName, upload.filePath, upload.fileData, upload.options)
			)
		);

		// 결과 처리
		for (const result of batchResults) {
			if (result.status === 'fulfilled') {
				results.push(result.value);
			} else {
				results.push({ error: result.reason?.message || 'Upload failed' });
			}
		}
	}

	return results;
}

/**
 * 파일명을 안전한 형식으로 정리 (특수 문자 제거)
 * @param fileName - 원본 파일명
 * @returns 정리된 파일명 (확장자 제외)
 */
function sanitizeFileName(fileName: string): string {
	// 확장자 제거
	const baseName = fileName.replace(/\.[^/.]+$/, '') || 'file';
	
	// 파일명이 비어있거나 공백만 있으면 기본값 사용
	if (!baseName || baseName.trim() === '') {
		return 'file';
	}
	
	// 특수 문자 제거 및 정리
	// - 유니코드 특수 문자를 일반 문자로 변환
	// - 한자, 한글, 일본어 등 모든 비영문 문자를 언더스코어로 변환
	// - 공백을 언더스코어로 변환
	// - 허용되지 않는 문자 제거
	let sanitized = baseName
		.normalize('NFD') // 유니코드 정규화 (예: é -> e + ´)
		.replace(/[\u0300-\u036f]/g, '') // 조합 문자 제거
		.replace(/[^a-zA-Z0-9_-]/g, '_') // 영문, 숫자, 언더스코어, 하이픈만 허용 (한자/한글 등은 언더스코어로)
		.replace(/_{2,}/g, '_') // 연속된 언더스코어를 하나로
		.replace(/^_+|_+$/g, ''); // 앞뒤 언더스코어 제거
	
	// 모든 문자가 언더스코어로 변환되어 비어있을 수 있음
	if (!sanitized || sanitized.trim() === '') {
		return 'file';
	}
	
	// 최대 길이 제한
	return sanitized.substring(0, 100);
}

/**
 * 파일 경로 생성 헬퍼 (캐릭터 ID 기반 폴더 구조)
 * @param prefix - 경로 접두사 (예: 'characters', 'worlds')
 * @param fileName - 파일 이름
 * @param packId - 캐릭터 팩 ID (선택적, 있으면 ID 기반 폴더 사용)
 * @returns 생성된 파일 경로
 */
export function generateStoragePath(prefix: string, fileName: string, packId?: string): string {
	// 고유한 파일명 생성 (타임스탬프 + 랜덤 문자열)
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 9);
	
	// 확장자 추출 (파일명에서 마지막 점 이후)
	const extMatch = fileName.match(/\.([^.]+)$/);
	const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
	
	// 파일명 정리 (특수 문자 제거, 확장자 제외)
	const sanitizedBaseName = sanitizeFileName(fileName);
	const uniqueFileName = `${sanitizedBaseName}_${timestamp}_${random}.${ext}`;

	// 캐릭터 ID가 있으면 ID 기반 폴더 구조 사용
	if (packId) {
		return `${prefix}/${packId}/${uniqueFileName}`;
	}

	// 캐릭터 ID가 없으면 날짜 기반 폴더 구조 사용 (하위 호환성)
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${prefix}/${year}/${month}/${day}/${uniqueFileName}`;
}

/**
 * Storage에서 파일 삭제
 * @param bucketName - 버킷 이름
 * @param filePath - 삭제할 파일 경로 (또는 파일 경로 배열)
 */
export async function deleteFromStorage(bucketName: string, filePath: string | string[]): Promise<void> {
	const paths = Array.isArray(filePath) ? filePath : [filePath];
	const { error } = await supabase.storage.from(bucketName).remove(paths);

	if (error) {
		throw new Error(`Failed to delete file from storage: ${error.message}`);
	}
}

/**
 * Storage에서 폴더 전체 삭제
 * @param bucketName - 버킷 이름
 * @param folderPath - 삭제할 폴더 경로 (예: 'characters/pack-id')
 */
export async function deleteFolderFromStorage(bucketName: string, folderPath: string): Promise<void> {
	// 폴더 내 모든 파일 목록 가져오기
	const { data: files, error: listError } = await supabase.storage
		.from(bucketName)
		.list(folderPath, {
			limit: 1000,
			offset: 0,
			sortBy: { column: 'name', order: 'asc' }
		});

	if (listError) {
		throw new Error(`Failed to list files in folder: ${listError.message}`);
	}

	if (!files || files.length === 0) {
		console.log(`[Storage] Folder ${folderPath} is empty or does not exist`);
		return;
	}

	// 모든 파일 경로 수집
	const filePaths = files.map((file) => {
		// 폴더 경로가 있으면 포함, 없으면 파일명만
		return folderPath ? `${folderPath}/${file.name}` : file.name;
	});

	// 파일들 삭제
	if (filePaths.length > 0) {
		await deleteFromStorage(bucketName, filePaths);
		console.log(`[Storage] Deleted ${filePaths.length} files from folder: ${folderPath}`);
	}
}

