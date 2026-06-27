export {};

import type { DownloadFormat } from '@/utils/downloadFormats';

declare global {
    interface ChatSaverDownloadResult {
        success: boolean;
        siteName?: string;
        errorMessage?: string;
    }

    var chatSaverDownload:
        | ((
              formats?: DownloadFormat[],
          ) => ChatSaverDownloadResult | Promise<ChatSaverDownloadResult>)
        | undefined;
    var chatSaverDownloadSignature: string | undefined;
}
