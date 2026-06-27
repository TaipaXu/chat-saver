import { createVuetify } from 'vuetify';
import type { IconAliases } from 'vuetify';
import 'vuetify/styles';
import colors from 'vuetify/lib/util/colors.mjs';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import { getSystemTheme } from '@/utils/theme';

export function createExtensionVuetify(iconAliases: Partial<IconAliases> = {}) {
    return createVuetify({
        theme: {
            defaultTheme: getSystemTheme(),
            themes: {
                light: {
                    colors: {
                        primary: colors.green.darken1,
                        secondary: colors.green.lighten5,
                    },
                },
                dark: {
                    colors: {
                        primary: colors.green.lighten1,
                        secondary: colors.green.darken4,
                    },
                },
            },
        },
        icons: {
            defaultSet: 'mdi',
            aliases: {
                ...aliases,
                ...iconAliases,
            },
            sets: {
                mdi,
            },
        },
    });
}
