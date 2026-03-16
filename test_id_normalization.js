
import { getChannelInfo } from './src/services/apify.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
    const urls = [
        'https://www.youtube.com/@MargulanSeisembai',
        'https://www.youtube.com/channel/UCTHXtr2FZibOytQV7Yt7FqA',
        'https://www.youtube.com/user/MargulanSeisembai'
    ];
    
    for (const url of urls) {
        console.log(`Testing URL: ${url}`);
        const info = await getChannelInfo(url);
        console.log(`Result ID: ${info?.id}, Name: ${info?.name}`);
    }
}

test();
