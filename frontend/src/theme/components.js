// Los mismos ajustes de componentes que AMSA Gestión (frontend/src/theme/components.ts), más lo que pide un uso
// pensado para el celular: los campos tienen 16 px de letra debajo de `sm` (con menos, iOS hace zoom al enfocarlos).

/** @param {'light'|'dark'} mode */
export function buildComponents(mode) {
    return {
        MuiCssBaseline: {
            styleOverrides: {
                '*': {
                    scrollbarWidth: 'thin',
                    scrollbarColor: mode === 'dark'
                        ? 'rgba(255,255,255,0.18) transparent'
                        : 'rgba(15,23,42,0.2) transparent',
                },
                '*::-webkit-scrollbar': {
                    width: 8,
                    height: 8,
                },
                '*::-webkit-scrollbar-track': {
                    background: 'transparent',
                },
                '*::-webkit-scrollbar-thumb': {
                    backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.2)',
                    borderRadius: 8,
                    border: '2px solid transparent',
                    backgroundClip: 'padding-box',
                },
                '*::-webkit-scrollbar-thumb:hover': {
                    backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.32)' : 'rgba(15,23,42,0.35)',
                },
                '*::-webkit-scrollbar-corner': {
                    background: 'transparent',
                },
                body: {
                    WebkitTapHighlightColor: 'transparent',
                    fontVariantNumeric: 'normal',
                },
                '.num, .tabular': {
                    fontVariantNumeric: 'tabular-nums',
                },
                '@media (prefers-reduced-motion: reduce)': {
                    '*, *::before, *::after': {
                        transitionDuration: '0.001ms !important',
                        animationDuration: '0.001ms !important',
                    },
                },
            },
        },

        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },

        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },

        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 8,
                },
            },
        },

        MuiAppBar: {
            styleOverrides: {
                root: ({ theme }) => ({
                    backgroundImage: 'none',
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.background.marco,
                }),
            },
        },

        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundImage: 'none',
                    borderRight: 'none',
                },
            },
        },

        MuiDialog: {
            styleOverrides: {
                paper: ({ theme }) => ({
                    borderRadius: 16,
                    [theme.breakpoints.down('sm')]: {
                        '&.MuiDialog-paperFullScreen': { borderRadius: 0 },
                    },
                }),
            },
        },

        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontSize: '1.125rem',
                    fontWeight: 650,
                },
            },
        },

        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                },
            },
        },

        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 500,
                    fontSize: '0.75rem',
                },
            },
        },

        MuiTooltip: {
            defaultProps: {
                arrow: true,
            },
            styleOverrides: {
                tooltip: {
                    fontSize: '0.75rem',
                },
            },
        },

        MuiTableHead: {
            styleOverrides: {
                root: {
                    '& .MuiTableCell-head': {
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: mode === 'light' ? '#475569' : '#94A3B8',
                    },
                },
            },
        },

        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottomColor: mode === 'light' ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.06)',
                    fontVariantNumeric: 'tabular-nums',
                },
            },
        },

        MuiInputBase: {
            styleOverrides: {
                root: ({ theme }) => ({
                    fontSize: '0.9375rem',
                    [theme.breakpoints.down('sm')]: {
                        fontSize: '1rem',
                    },
                }),
            },
        },

        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                },
            },
        },

        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                },
            },
        },

        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    minHeight: 44,
                },
            },
        },

        MuiLink: {
            defaultProps: {
                underline: 'hover',
            },
        },
    };
}
