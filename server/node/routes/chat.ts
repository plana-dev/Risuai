/**
 * 채팅 API 엔드포인트
 * POST /api/chat/send - 채팅 전송
 * GET /api/chat/:chatId - 채팅 조회
 * WebSocket /api/chat/stream - 스트리밍 채팅
 * 
 * CommonJS 형식으로 작성 (server.cjs와 호환)
 */

const { createProcessContext } = require('../../src/server/process/context');
const { sendChat } = require('../../src/server/process/chat/send-chat');
const { getDatabaseAdapter } = require('../../src/server/database-adapter');
const { v4: uuidv4 } = require('uuid');
const express = require('express');

const router = express.Router();

/**
 * POST /api/chat/send
 * 채팅 메시지 전송 및 처리
 * 
 * Request Body:
 * {
 *   userId: string;
 *   characterId: string;
 *   chatId: string;
 *   message?: string; // 사용자 메시지 (선택적, 이미 채팅에 추가되어 있을 수 있음)
 *   options?: {
 *     chatAdditionalTokens?: number;
 *     continue?: boolean;
 *     usedContinueTokens?: number;
 *     preview?: boolean;
 *     previewPrompt?: boolean;
 *   }
 * }
 */
router.post('/send', async (req, res) => {
    try {
        const { userId, characterId, chatId, message, options } = req.body;

        if (!userId || !characterId || !chatId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: userId, characterId, chatId',
            });
        }

        // ProcessContext 생성
        const context = await createProcessContext(userId, characterId, chatId, options);

        // 사용자 메시지가 제공된 경우 채팅에 추가
        if (message) {
            const databaseAdapter = getDatabaseAdapter();
            const chat = await databaseAdapter.loadChat(userId, chatId);
            if (chat) {
                chat.message.push({
                    role: 'user',
                    data: message,
                    time: Date.now(),
                    chatId: uuidv4(),
                });
                await databaseAdapter.saveChat(userId, chat);
                // Context 업데이트
                context.chat = chat;
            }
        }

        // sendChat 호출
        const result = await sendChat(context, -1, {
            chatAdditonalTokens: options?.chatAdditionalTokens,
            continue: options?.continue,
            usedContinueTokens: options?.usedContinueTokens,
            preview: options?.preview,
            previewPrompt: options?.previewPrompt,
        });

        if (!result.success) {
            return res.status(500).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error('[Chat API] Error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/chat/:chatId
 * 채팅 조회
 * 
 * Query Parameters:
 * - userId: string (required)
 * - characterId: string (required)
 */
router.get('/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { userId, characterId } = req.query;

        if (!userId || !characterId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: userId, characterId',
            });
        }

        const databaseAdapter = getDatabaseAdapter();
        const chat = await databaseAdapter.loadChat(userId as string, chatId);

        if (!chat) {
            return res.status(404).json({
                success: false,
                error: 'Chat not found',
            });
        }

        return res.json({
            success: true,
            chat,
        });
    } catch (error) {
        console.error('[Chat API] Error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

module.exports = router;
