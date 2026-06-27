export const downloadFormatOptions = [
    { value: 'md', label: 'Markdown (.md)' },
    { value: 'png', label: 'Image (.png)' },
] as const;

export type DownloadFormat = (typeof downloadFormatOptions)[number]['value'];
export type DownloadFormatSelection = Record<DownloadFormat, boolean>;

export const allDownloadFormats: DownloadFormat[] = downloadFormatOptions.map(({ value }) => value);

const downloadFormatValues = new Set<string>(allDownloadFormats);

export const isDownloadFormat = (value: unknown): value is DownloadFormat =>
    typeof value === 'string' && downloadFormatValues.has(value);

export const normalizeDownloadFormats = (formats: readonly unknown[]): DownloadFormat[] =>
    Array.from(new Set(formats.filter(isDownloadFormat)));

export const createDefaultDownloadFormatSelection = (): DownloadFormatSelection =>
    Object.fromEntries(
        downloadFormatOptions.map(({ value }) => [value, true]),
    ) as DownloadFormatSelection;

export const normalizeDownloadFormatSelection = (selection: unknown): DownloadFormatSelection => {
    if (selection === null || typeof selection !== 'object' || Array.isArray(selection)) {
        return createDefaultDownloadFormatSelection();
    }

    const selectionRecord = selection as Record<string, unknown>;

    return Object.fromEntries(
        downloadFormatOptions.map(({ value }) => {
            const selected = selectionRecord[value];
            return [value, typeof selected === 'boolean' ? selected : true];
        }),
    ) as DownloadFormatSelection;
};
