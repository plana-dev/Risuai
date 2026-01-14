/**
 * Asset 서비스 - Supabase Storage 통합
 * 파일 업로드/다운로드 및 메타데이터 관리
 * 기존 src/lib/supabase/storage.ts의 함수들을 활용
 */

import { supabase } from '../lib/supabase/client.js';
import { uploadToStorage, generateStoragePath, deleteFromStorage } from '../lib/supabase/storage.js';
import { STORAGE_BUCKETS } from '../lib/supabase/storage.js';
import { randomUUID } from 'crypto';

export class AssetService {
  private bucketName: string;

  constructor() {
    this.bucketName = STORAGE_BUCKETS.USER_ASSETS;
  }

  /**
   * Supabase 클라이언트 초기화 (기존 클라이언트 사용)
   */
  async initialize(): Promise<void> {
    // 기존 supabase 클라이언트를 사용하므로 별도 초기화 불필요
    return Promise.resolve();
  }

  /**
   * 파일 업로드
   * 기존 uploadToStorage 함수 활용
   */
  async uploadFile(
    userId: string,
    characterId: string | null,
    fileData: Buffer | Uint8Array,
    fileName: string,
    mimeType: string
  ): Promise<{ path: string; url: string; fileId: string; fileName: string; mimeType: string }> {
    await this.initialize();

    // 경로 생성
    const fileId = randomUUID();
    const fileExtension = fileName.split('.').pop() || 'bin';
    const prefix = characterId ? 'characters' : 'user-assets';
    const packId = characterId ? `${userId}/${characterId}` : userId;
    const storagePath = generateStoragePath(prefix, fileName, packId);

    // 기존 uploadToStorage 함수 사용
    const result = await uploadToStorage(
      this.bucketName,
      storagePath,
      fileData,
      {
        contentType: mimeType,
        upsert: false,
        ensureBucket: true,
      }
    );

    return {
      path: result.path,
      url: result.publicUrl,
      fileId,
      fileName,
      mimeType,
    };
  }

  /**
   * 파일 다운로드
   */
  async downloadFile(path: string): Promise<Buffer> {
    await this.initialize();

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .download(path);

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  /**
   * 파일 삭제
   * 기존 deleteFromStorage 함수 활용
   */
  async deleteFile(path: string): Promise<void> {
    await this.initialize();
    await deleteFromStorage(this.bucketName, path);
  }

  /**
   * 사용자의 모든 파일 목록 조회
   */
  async listFiles(userId: string, characterId: string | null = null): Promise<any[]> {
    await this.initialize();

    const prefix = characterId ? `${userId}/${characterId}/` : `${userId}/`;

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .list(prefix, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Signed URL 생성
   */
  async createSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    await this.initialize();

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Public URL 생성 (버킷이 public인 경우)
   */
  getPublicUrl(path: string): string {
    const { data } = supabase.storage.from(this.bucketName).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * 파일 메타데이터 조회
   */
  async getFileMetadata(path: string): Promise<any> {
    await this.initialize();

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .list(path.split('/').slice(0, -1).join('/'), {
        search: path.split('/').pop(),
      });

    if (error || !data || data.length === 0) {
      throw new Error(`Failed to get file metadata: ${error?.message || 'File not found'}`);
    }

    return data[0];
  }

  /**
   * 이미지 최적화 URL 생성 (Supabase 이미지 변환 기능 사용)
   */
  getOptimizedImageUrl(path: string, options: { width?: number; height?: number; quality?: number; format?: string } = {}): string {
    const baseUrl = this.getPublicUrl(path);
    const params = new URLSearchParams();

    if (options.width) params.append('width', options.width.toString());
    if (options.height) params.append('height', options.height.toString());
    if (options.quality) params.append('quality', options.quality.toString());
    if (options.format) params.append('format', options.format);

    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }
}

// 싱글톤 인스턴스
let assetServiceInstance: AssetService | null = null;

/**
 * Asset 서비스 싱글톤 인스턴스 반환
 */
export function getAssetService(): AssetService {
  if (!assetServiceInstance) {
    assetServiceInstance = new AssetService();
  }
  return assetServiceInstance;
}
