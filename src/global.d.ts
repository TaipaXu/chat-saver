export {};

import type { DownloadFormat } from '@/utils/downloadFormats';

declare global {
    var chatSaverDownload: ((formats?: DownloadFormat[]) => void | Promise<void>) | undefined;
    var chatSaverDownloadFormatSignature: string | undefined;
}
