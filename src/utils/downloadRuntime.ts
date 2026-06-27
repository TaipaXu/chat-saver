import { allDownloadFormats } from '@/utils/downloadFormats';
import { supportedChatSites } from '@/utils/chatSites';

export const chatSaverDownloadSignature = [
    allDownloadFormats.join(','),
    supportedChatSites.map(({ id }) => id).join(','),
    'download-runtime-v1',
].join('|');
