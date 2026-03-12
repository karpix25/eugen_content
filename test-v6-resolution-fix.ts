import { processClip } from './src/services/processor.js';

async function test() {
    console.log("Starting test processClip for Forced 1080x1920 Resolution Fix");
    
    // Using a known horizontal video to test padding/scaling
    const videoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"; 
    const fakePlaqueUrl = 'https://placehold.co/600x100.png'; 

    const plaqueConfig: any = {
        position: 'center',
        size: 40, 
        timerange: 0
    };

    try {
        const result = await processClip(
            'test_v6_resolution',
            videoUrl,
            fakePlaqueUrl,
            null,
            null,
            true, // skipUpload
            null,
            plaqueConfig,
            { enabled: false } as any
        );
        console.log("Result:", result);
        console.log("Please verify that the output video is 1080x1920 and letterboxed.");
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
