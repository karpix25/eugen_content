import { Telegraf, Context, Markup } from 'telegraf';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../lib/db.js';

dotenv.config();

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Authorization check middleware
const authMiddleware = async (ctx: Context, next: () => Promise<void>) => {
    const from = ctx.from;
    if (!from) return;

    const res = await query('SELECT is_authorized FROM users WHERE telegram_id = $1', [from.id]);
    if (res.rows.length === 0) {
        await query(
            'INSERT INTO users (telegram_id, username, first_name) VALUES ($1, $2, $3)',
            [from.id, from.username, from.first_name]
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
            const isAdminUser = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(id => id.trim()).includes(String(from.id)) || 
                                (process.env.ADMIN_TELEGRAM_ID || "").trim() === String(from.id) ||
                                from.id === 0; // fallback for dev

            const token = jwt.sign(
                { id: from.id, username: from.username, first_name: from.first_name, is_admin: isAdminUser },
                process.env.JWT_SECRET || 'fallback_secret',
                { expiresIn: '30d' } // Extended to 30d for convenience
            );

            // ENSURE USER EXISTS IN users TABLE (Fixes FK violation in publications)
            await query(
                `INSERT INTO users (telegram_id, username, first_name) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (telegram_id) DO UPDATE SET 
                    username = EXCLUDED.username, 
                    first_name = EXCLUDED.first_name,
                    is_authorized = CASE WHEN users.is_authorized = TRUE THEN TRUE ELSE EXCLUDED.is_authorized END`,
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

    const res = await query('SELECT is_authorized FROM users WHERE telegram_id = $1', [from.id]);

    if (res.rows.length === 0) {
        await query(
            'INSERT INTO users (telegram_id, username, first_name) VALUES ($1, $2, $3)',
            [from.id, from.username, from.first_name]
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

    let message = 'Доступные видео:\n\n';
    res.rows.forEach((clip, index) => {
        message += `${index + 1}. ${clip.title}\n Скачать: /dl_${clip.id}\n\n`;
    });

    return ctx.reply(message);
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
        [from.id, clipId]
    );

    await ctx.reply(`Вы скачали: ${clip.title}`);
    return ctx.replyWithVideo(clip.url, { width: 1080, height: 1920 });
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
            // Check if this reply is to a known publication message
            const res = await query(
                'SELECT id FROM publications WHERE user_id = $1 AND message_id = $2',
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
            
            return ctx.reply('✅ Ссылка сохранена! Отличная работа.');
        } else {
             return ctx.reply('Не удалось найти публикацию для этой ссылки. Пожалуйста, отправьте ссылку ответом (Reply) на сообщение с видео.');
        }
    }
});

export const sendCarouselToTelegram = async (telegramId: string, slicePaths: string[]) => {
    try {
        const media = slicePaths.map((path, index) => ({
            type: 'photo' as const,
            media: { source: path },
            caption: index === 0 ? '🎡 Ваша новая карусель готова!' : undefined
        }));
        
        await bot.telegram.sendMediaGroup(telegramId, media);
        console.log(`Carousel sent to Telegram user ${telegramId}`);
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
