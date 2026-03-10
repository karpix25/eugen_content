require("dotenv").config();
const { DeepgramClient } = require("@deepgram/sdk");

const deepgram = new DeepgramClient(process.env.DEEPGRAM_API_KEY || "");

async function test() {
    try {
        const { result, error } = await deepgram.listen.v1.media.transcribeUrl(
            { url: "https://www.w3schools.com/html/mov_bbb.mp4" }, // sample mp4
            {
                model: 'nova-2',
                language: 'en',
            }
        );
        console.log("Error:", error);
        console.log("Result Keys:", Object.keys(result || {}));
        if (result && result.results) {
            console.log("Channels Length:", result.results.channels.length);
            console.log("Alternatives Length:", result.results.channels[0].alternatives.length);
            const words = result.results.channels[0].alternatives[0].words;
            console.log("Words Array present:", !!words, "Length:", words ? words.length : undefined);
            if (!words) {
                 console.log("Alt object:", Object.keys(result.results.channels[0].alternatives[0]));
            }
        }
    } catch (err) {
        console.error("Crash:", err);
    }
}
test();
