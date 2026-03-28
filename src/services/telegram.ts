import { Telegraf, Context, Markup } from 'telegraf';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../lib/db.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { normalizeRemoteUrl } from '../lib/s3.js';
import { PreviewGenerator } from './preview-generator';
import { ensurePlayableClipUrl, isExpiredOrNearExpiryUrl, isTemporaryVizardUrl } from './vizard.js';

dotenv.config();

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const TELEGRAM_MESSAGE_SAFE_LIMIT = 3500;

const buildReportKeyboard = (publicationId: string) => ({
    inline_keyboard: [
        [{ text: "Отчитаться ссылкой 🔗", callback_data: `report_link_${publicationId}` }]
    ]
});

const isTelegramRemoteVideoFetchError = (err: any) => {
    const message = String(err?.message || '').toLowerCase();
    return (
        message.includes('wrong type of the web page content') ||
        message.includes('failed to get http url content') ||
        message.includes('wrong file identifier/http url specified')
    );
};

const downloadVideoToTempFile = async (videoUrl: string, clipId: string) => {
    const tempDir = path.join('/tmp', 'telegram-video-fallback');
    fs.mkdirSync(tempDir, { recursive: true });

    const tempFilePath = path.join(tempDir, `${clipId}_${Date.now()}.mp4`);
    const writer = fs.createWriteStream(tempFilePath);
    const response = await axios({
        url: videoUrl,
        method: 'GET',
        responseType: 'stream'
    });

    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
    });

    return tempFilePath;
};

const splitTextIntoTelegramMessages = (header: string, lines: string[]) => {
    const chunks: string[] = [];
    let currentChunk = header;

    for (const line of lines) {
        if ((currentChunk + line).length > TELEGRAM_MESSAGE_SAFE_LIMIT) {
            chunks.push(currentChunk.trimEnd());
            currentChunk = `${header}${line}`;
            continue;
        }

        currentChunk += line;
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trimEnd());
    }

    return chunks;
};

const getCarouselControlText = (status: 'ready' | 'generating' | 'error') => {
    if (status === 'generating') return 'Статус карусели: генерируется...';
    if (status === 'error') return 'Статус карусели: ошибка генерации.';
    return 'Статус карусели: готово.';
};

const getCarouselControlKeyboard = (carouselId: string, publicationId?: string | null, status: 'ready' | 'generating' | 'error' = 'ready') => {
    const inlineKeyboard: Array<Array<{ text: string; callback_data: string }>> = [];

    if (publicationId) {
        inlineKeyboard.push([{ text: "Отчитаться ссылкой 🔗", callback_data: `report_link_${publicationId}` }]);
    }

    if (status === 'generating') {
        inlineKeyboard.push([{ text: "⏳ Генерируется...", callback_data: `carousel_status_${carouselId}` }]);
    } else if (status === 'error') {
        inlineKeyboard.push([{ text: "🔄 Попробовать снова", callback_data: `regen_carousel_${carouselId}` }]);
    } else {
        inlineKeyboard.push([{ text: "✅ Готово", callback_data: `carousel_status_${carouselId}` }]);
        inlineKeyboard.push([{ text: "🔄 Пересоздать", callback_data: `regen_carousel_${carouselId}` }]);
    }

    return inlineKeyboard;
};

export const updateCarouselControlMessage = async (
    telegramId: string,
    carouselId: string,
    status: 'ready' | 'generating' | 'error',
    publicationId?: string | null
) => {
    const carouselRes = await query("SELECT control_message_id FROM carousels WHERE id = $1", [carouselId]);
    const controlMessageId = carouselRes.rows[0]?.control_message_id;

    if (!controlMessageId) return null;

    const keyboard = getCarouselControlKeyboard(carouselId, publicationId, status);
    await bot.telegram.editMessageText(
        telegramId,
        Number(controlMessageId),
        undefined,
        getCarouselControlText(status),
        { reply_markup: { inline_keyboard: keyboard } }
    );

    return Number(controlMessageId);
};

export const sendClipToTelegram = async (
    telegramId: string,
    clip: { id: string; title: string; url: string },
    options: { plaqueId?: string | null; caption?: string } = {}
) => {
    const normalizedClipUrl = normalizeRemoteUrl(clip.url);
    const playableUrl = normalizedClipUrl && (!isTemporaryVizardUrl(normalizedClipUrl) || !isExpiredOrNearExpiryUrl(normalizedClipUrl))
        ? normalizedClipUrl
        : await ensurePlayableClipUrl(clip.id, clip.url);

    if (!playableUrl) {
        throw new Error(`No playable Telegram source found for clip ${clip.id}`);
    }

    let thumbBuffer: Buffer | undefined;

    try {
        thumbBuffer = await PreviewGenerator.generateVideoThumbnail(playableUrl, clip.title);
    } catch (videoThumbErr) {
        console.warn('Failed to generate video thumb for clip, falling back to font hook:', videoThumbErr);
        try {
            thumbBuffer = await PreviewGenerator.generateFontHook(clip.title);
        } catch (fontThumbErr) {
            console.warn('Failed fallback font hook thumb:', fontThumbErr);
        }
    }

    await query(
        `INSERT INTO users (telegram_id)
         VALUES ($1)
         ON CONFLICT (telegram_id) DO NOTHING`,
        [String(telegramId)]
    );

    const sendVideoOptions = {
        width: 1080,
        height: 1920,
        supports_streaming: true,
        thumbnail: thumbBuffer ? { source: thumbBuffer } : undefined,
        caption: options.caption || `⬜️ ${clip.title}`,
        reply_markup: {
            inline_keyboard: [
                [{ text: "Отчитаться ссылкой 🔗", callback_data: `report_link_temp` }]
            ]
        }
    };

    let message;

    try {
        message = await bot.telegram.sendVideo(telegramId, playableUrl, sendVideoOptions);
    } catch (err: any) {
        if (!isTelegramRemoteVideoFetchError(err)) {
            throw err;
        }

        console.warn(`Telegram rejected remote video URL for clip ${clip.id}. Falling back to local file upload.`, err.message);

        let tempFilePath: string | null = null;
        try {
            tempFilePath = await downloadVideoToTempFile(playableUrl, clip.id);
            message = await bot.telegram.sendVideo(telegramId, {
                source: fs.createReadStream(tempFilePath)
            }, sendVideoOptions);
        } finally {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }

    const pubRes = await query(
        "INSERT INTO publications (clip_id, user_id, plaque_id, message_id, type, status) VALUES ($1, $2, $3, $4, 'video', 'sent') RETURNING id",
        [clip.id, String(telegramId), options.plaqueId || null, message.message_id]
    );
    const publicationId = pubRes.rows[0].id;

    await bot.telegram.editMessageReplyMarkup(telegramId, message.message_id, undefined, buildReportKeyboard(publicationId));

    return {
        publicationId,
        messageId: message.message_id
    };
};

bot.catch((err, ctx) => {
    console.error('Unhandled Telegram bot error:', err, {
        update_id: ctx.update.update_id,
        update_type: ctx.updateType
    });
});

// Authorization check middleware
const authMiddleware = async (ctx: Context, next: () => Promise<void>) => {
    const from = ctx.from;
    if (!from) return;

    const res = await query('SELECT is_authorized FROM users WHERE telegram_id = $1', [String(from.id)]);
    if (res.rows.length === 0) {
        await query(
            'INSERT INTO users (telegram_id, username, first_name) VALUES ($1, $2, $3)',
            [String(from.id), from.username, from.first_name]
        );
        return ctx.reply('Вы зарегистрированы. Дождитесь подтверждения от администратора.');
    }

    if (!res.rows[0].is_authorized) {
        return ctx.reply('Ваш аккаунт еще не авторизован.');
    }

    return next();
};

bot.start(async (ctx) => {
    const from = ctx.from;
    const startPayload = ctx.payload;
    
    console.log(`Bot /start matched from ${from.username} (ID: ${from.id}) with payload: ${startPayload}`);

    // Handle deep-link login
    if (startPayload && startPayload.startsWith('login_')) {
        const sessionId = startPayload.replace('login_', '');

        try {
            // Verify session exists and is pending
            const sessionRes = await query('SELECT * FROM auth_sessions WHERE id = $1 AND status = \'pending\'', [sessionId]);
            if (sessionRes.rows.length === 0) {
                return ctx.reply('Срок действия сессии истек или ссылка недействительна. Попробуйте еще раз на сайте.');
            }

            // Mark session as authorized
            const dbUserRes = await query('SELECT is_admin FROM users WHERE telegram_id = $1', [String(from.id)]);
            const isAdminInDb = dbUserRes.rows[0]?.is_admin === true;
            
            const isAdminUser = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(id => id.trim()).includes(String(from.id)) || 
                                (process.env.ADMIN_TELEGRAM_ID || "").trim() === String(from.id) ||
                                from.id === 0 || // fallback for dev
                                isAdminInDb;

            const token = jwt.sign(
                { id: String(from.id), username: from.username, first_name: from.first_name, is_admin: isAdminUser },
                process.env.JWT_SECRET || 'fallback_secret',
                { expiresIn: '30d' } // Extended to 30d for convenience
            );

            // ENSURE USER EXISTS IN users TABLE (Fixes FK violation in publications)
            // AND mark them as authorized since they are logging in via a valid site link
            await query(
                `INSERT INTO users (telegram_id, username, first_name, is_authorized) 
                 VALUES ($1, $2, $3, TRUE) 
                 ON CONFLICT (telegram_id) DO UPDATE SET 
                    username = EXCLUDED.username, 
                    first_name = EXCLUDED.first_name,
                    is_authorized = TRUE`,
                [String(from.id), from.username, from.first_name]
            );

            await query(
                'UPDATE auth_sessions SET status = \'authorized\', telegram_id = $1, username = $2, first_name = $3, jwt = $4 WHERE id = $5',
                [String(from.id), from.username, from.first_name, token, sessionId]
            );

            const siteUrl = process.env.SITE_URL || 'https://eugen.karpix.com';

            return ctx.reply('✅ Вы успешно авторизованы!', Markup.inlineKeyboard([
                Markup.button.url('Вернуться на сайт 🌐', siteUrl)
            ]));
        } catch (err) {
            console.error('Auth update error:', err);
            return ctx.reply('Произошла ошибка при авторизации. Пожалуйста, попробуйте позже.');
        }
    }

    const res = await query('SELECT is_authorized FROM users WHERE telegram_id = $1', [String(from.id)]);

    if (res.rows.length === 0) {
        await query(
            'INSERT INTO users (telegram_id, username, first_name) VALUES ($1, $2, $3)',
            [String(from.id), from.username, from.first_name]
        );
        return ctx.reply('Добро пожаловать! Вы зарегистрированы. Дождитесь подтверждения от администратора.');
    }

    if (res.rows[0].is_authorized) {
        return ctx.reply('С возвращением! Используйте /videos чтобы увидеть доступные ролики.');
    }

    return ctx.reply('Ваш аккаунт еще не авторизован.');
});

bot.command('videos', authMiddleware, async (ctx) => {
    const res = await query(
        'SELECT id, title FROM clips WHERE is_available = TRUE AND status = \'processed\' ORDER BY created_at DESC'
    );

    if (res.rows.length === 0) {
        return ctx.reply('На данный момент нет доступных видео для скачивания.');
    }

    const lines = res.rows.map((clip, index) => `${index + 1}. ${clip.title}\nСкачать: /dl_${clip.id}\n\n`);
    const chunks = splitTextIntoTelegramMessages('Доступные видео:\n\n', lines);

    for (const chunk of chunks) {
        await ctx.reply(chunk);
    }

    return;
});

// Handle /dl_CLIPID
bot.hears(/^\/dl_([\w-]+)$/, authMiddleware, async (ctx) => {
    const clipId = ctx.match[1];
    const from = ctx.from!;

    const res = await query(
        'SELECT * FROM clips WHERE id = $1 AND is_available = TRUE AND status = \'processed\'',
        [clipId]
    );

    if (res.rows.length === 0) {
        return ctx.reply('Это видео уже скачано кем-то другим или недоступно.');
    }

    const clip = res.rows[0];

    // Mark as downloaded
    await query(
        'UPDATE clips SET is_available = FALSE, downloaded_by = $1, downloaded_at = NOW() WHERE id = $2',
        [String(from.id), clipId]
    );

    await ctx.reply(`Вы скачали: ${clip.title}`);
    
    await sendClipToTelegram(String(from.id), {
        id: clipId,
        title: clip.title,
        url: clip.url
    });

    return;
});

// Handle URL reporting
bot.on('text', authMiddleware, async (ctx) => {
    const text = ctx.message.text;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);

    if (urls && urls.length > 0) {
        const from = ctx.from!;
        const replyToMessage = ctx.message.reply_to_message;
        let publicationId = null;

        if (replyToMessage && replyToMessage.message_id) {
            // Check if this reply is to a known publication message OR its control message
            const res = await query(
                'SELECT id FROM publications WHERE user_id = $1 AND (message_id = $2 OR control_message_id = $2)',
                [from.id.toString(), replyToMessage.message_id]
            );
            if (res.rows.length > 0) {
                publicationId = res.rows[0].id;
            }
        }

        if (!publicationId) {
            // Fallback to the most recent publication
            const res = await query(
                'SELECT id FROM publications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
                [from.id.toString()]
            );
            if (res.rows.length > 0) {
                publicationId = res.rows[0].id;
            }
        }

        if (publicationId) {
            // Update the publication
            await query(
                `UPDATE publications 
                 SET social_links = social_links || $1::text[], 
                     status = 'published', 
                     updated_at = NOW() 
                 WHERE id = $2`,
                [urls, publicationId]
            );
            
            // Try to update the original message to show a checkmark
            try {
                const pubRes = await query('SELECT message_id, clip_id FROM publications WHERE id = $1', [publicationId]);
                if (pubRes.rows.length > 0) {
                    const { message_id, clip_id } = pubRes.rows[0];
                    const clipRes = await query('SELECT title FROM clips WHERE id = $1', [clip_id]);
                    const title = clipRes.rows[0]?.title || 'Видео';
                    
                    await bot.telegram.editMessageCaption(from.id, Number(message_id), undefined, `✅ [Отчёт] ${title}`);
                }
            } catch (editErr) {
                console.warn('Failed to edit message caption after report:', editErr);
            }

            return ctx.reply('✅ Ссылка сохранена! Отличная работа.');
        } else {
             return ctx.reply('Не удалось найти публикацию для этой ссылки. Пожалуйста, отправьте ссылку ответом (Reply) на сообщение с видео.');
        }
    }
});

// Action for reporting links via button
bot.action(/^report_link_(.+)$/, async (ctx) => {
    const pubId = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.reply('Пришлите ссылку на опубликованный ролик в ответ на это сообщение (или через Reply к самому видео):', {
        reply_markup: { force_reply: true }
    });
});

bot.action(/^carousel_status_(.+)$/, async (ctx) => {
    const carouselId = ctx.match[1];
    const res = await query("SELECT status FROM carousels WHERE id = $1", [carouselId]);
    const status = res.rows[0]?.status;

    if (status === 'ready') {
        await ctx.answerCbQuery('Карусель уже готова.');
        return;
    }

    if (status === 'error') {
        await ctx.answerCbQuery('Генерация завершилась с ошибкой.');
        return;
    }

    await ctx.answerCbQuery('Карусель еще генерируется...');
});

// Action for re-generating carousels
bot.action(/^regen_carousel_(.+)$/, async (ctx) => {
    const carouselId = ctx.match[1];
    const from = ctx.from!;
    
    await ctx.answerCbQuery('Запускаю перегенерацию... ⏳');
    
    try {
        const { carouselQueue } = await import('../lib/queues.js');
        
        // Fetch original params
        const res = await query(
            "SELECT clip_id, style_id, topic, target_audience FROM carousels WHERE id = $1",
            [carouselId]
        );
        
        if (res.rows.length === 0) {
            return ctx.reply('❌ Ошибка: карусель не найдена в базе.');
        }
        
        const { clip_id, style_id, topic, target_audience } = res.rows[0];
        
        // Persist the current control message so worker can update the same message after completion.
        const currentControlMessageId = ctx.callbackQuery && 'message' in ctx.callbackQuery ? ctx.callbackQuery.message?.message_id : null;
        await query(
            "UPDATE carousels SET status = 'pending', slides = NULL, image_url = NULL, control_message_id = COALESCE($2, control_message_id) WHERE id = $1",
            [carouselId, currentControlMessageId || null]
        );

        if (currentControlMessageId) {
            try {
                const pubRes = await query(
                    "SELECT id FROM publications WHERE user_id = $1 AND clip_id = $2 AND type = 'carousel' ORDER BY created_at DESC LIMIT 1",
                    [String(from.id), clip_id]
                );
                const publicationId = pubRes.rows[0]?.id || null;
                await bot.telegram.editMessageText(
                    from.id,
                    currentControlMessageId,
                    undefined,
                    getCarouselControlText('generating'),
                    {
                        reply_markup: {
                            inline_keyboard: getCarouselControlKeyboard(carouselId, publicationId, 'generating')
                        }
                    }
                );
            } catch (editErr) {
                console.warn('Failed to update carousel control message to generating:', editErr);
            }
        }
        
        // Add to BullMQ queue
        await carouselQueue.add(`regen-${carouselId}`, {
            carouselId,
            clipId: clip_id,
            userId: String(from.id),
            styleId: style_id,
            topic,
            targetAudience: target_audience
        }, {
            jobId: `regen-${carouselId}-${Date.now()}` // Unique ID to avoid job ID collision if immediate retry
        });

    } catch (err: any) {
        console.error('Regen action error:', err);
        try {
            await updateCarouselControlMessage(String(from.id), carouselId, 'error');
        } catch (editErr) {
            console.warn('Failed to update carousel control message to error:', editErr);
        }
        await ctx.reply(`❌ Произошла ошибка: ${err.message}`);
    }
});

export const sendCarouselToTelegram = async (telegramId: string, slicePaths: string[], clipId?: string, carouselId?: string) => {
    try {
        const media = slicePaths.map((filePath, index) => ({
            type: 'photo' as const,
            media: { source: fs.createReadStream(filePath) },
            caption: index === 0 ? '🎡 Ваша новая карусель готова!' : undefined
        }));
        
        const messages = await bot.telegram.sendMediaGroup(telegramId, media);
        console.log(`Carousel sent to Telegram user ${telegramId}`);

        // Create publication and prepare buttons
        const inline_keyboard: any[][] = [];
        let pubId = null;

        if (clipId) {
            const lastMessageId = messages[messages.length - 1].message_id;
            const pubRes = await query(
                "INSERT INTO publications (clip_id, user_id, message_id, type, status) VALUES ($1, $2, $3, 'carousel', 'sent') RETURNING id",
                [clipId, String(telegramId), lastMessageId]
            );
            pubId = pubRes.rows[0].id;
            inline_keyboard.push([{ text: "Отчитаться ссылкой 🔗", callback_data: `report_link_${pubId}` }]);
        }

        if (carouselId) {
            let controlMessageId: number | null = null;
            try {
                controlMessageId = await updateCarouselControlMessage(String(telegramId), carouselId, 'ready', pubId);
            } catch (editErr) {
                console.warn('Failed to reuse carousel control message, sending a new one:', editErr);
            }

            if (!controlMessageId) {
                const controlMsg = await bot.telegram.sendMessage(telegramId, getCarouselControlText('ready'), {
                    reply_markup: { inline_keyboard: getCarouselControlKeyboard(carouselId, pubId, 'ready') }
                });
                controlMessageId = controlMsg.message_id;
                await query("UPDATE carousels SET control_message_id = $1 WHERE id = $2", [controlMessageId, carouselId]);
            }

            if (pubId && controlMessageId) {
                await query(
                    "UPDATE publications SET control_message_id = $1 WHERE id = $2",
                    [controlMessageId, pubId]
                );
            }
        } else if (inline_keyboard.length > 0) {
            const controlMsg = await bot.telegram.sendMessage(telegramId, 'Используйте кнопки ниже для управления:', {
                reply_markup: { inline_keyboard }
            });

            if (pubId) {
                await query(
                    "UPDATE publications SET control_message_id = $1 WHERE id = $2",
                    [controlMsg.message_id, pubId]
                );
            }
        }
    } catch (err: any) {
        console.error('Failed to send carousel to Telegram:', err.message);
        throw err;
    }
};

export const startBot = () => {
    console.log('Attempting to start Telegram Bot...');
    bot.launch()
        .then(() => console.log('✅ Telegram Bot started and listening'))
        .catch(err => {
            console.error('❌ Telegram Bot failed to start:', err.message);
            if (err.message.includes('401: Unauthorized')) {
                console.error('CRITICAL: Invalid TELEGRAM_BOT_TOKEN');
            }
        });
};

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
