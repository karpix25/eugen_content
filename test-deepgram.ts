import { DeepgramClient } from "@deepgram/sdk";
import { config } from "dotenv";
config();
const deepgram = new (DeepgramClient as any)(process.env.DEEPGRAM_API_KEY || "");
async function test() {
    const { result, error } = await deepgram.listen.v1.media.transcribeUrl(
        { url: "https://files.test.com/audio.mp4" }, // Put some audio file if needed, or we can use a known public audio
        {
            model: 'nova-2',
            language: 'en',
        }
    ) as any;
    console.log("Error:", error);
    console.log("Result Keys:", Object.keys(result || {}));
    if (result && result.results) console.log("Channels:", result.results.channels.length);
}
test().catch(console.error);
