/**
 * Overrides global console methods to include timestamps in all logs.
 */
export function initLogger() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const getTimestamp = () => {
        return new Date().toISOString();
    };

    console.log = (...args: any[]) => {
        originalLog(`[${getTimestamp()}]`, ...args);
    };

    console.error = (...args: any[]) => {
        originalError(`[${getTimestamp()}]`, ...args);
    };

    console.warn = (...args: any[]) => {
        originalWarn(`[${getTimestamp()}]`, ...args);
    };

    console.info = (...args: any[]) => {
        originalInfo(`[${getTimestamp()}]`, ...args);
    };
    
    console.log("Logger initialized with timestamps.");
}
