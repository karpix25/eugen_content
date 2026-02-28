import { Telegraf, Context } from 'telegraf';
import dotenv from 'dotenv';
import { query } from '../lib/db.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

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
    return ctx.replyWithVideo(clip.url);
});

export const startBot = () => {
    bot.launch()
        .then(() => console.log('Telegram Bot started'))
        .catch(err => console.error('Telegram Bot failed to start:', err.message));
};

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
