export {};

declare global {
    var chatSaverDownload: (() => void | Promise<void>) | undefined;
}
