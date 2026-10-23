import { Box, Link, Typography } from '@mui/material';
import { ChevronRight } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';

/** Las migas de pan arriba del título. Sin ítems no dibuja nada. */
export default function MigasDePan({ items }) {
    if (!items || items.length === 0) return null;
    return (
        <Box component="nav" aria-label="Migas de pan" sx={{ mb: 0.75 }}>
            <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                {items.map((item, i) => {
                    const ultimo = i === items.length - 1;
                    return (
                        <Box component="li" key={`${item.label}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {item.to && !ultimo ? (
                                <Link component={RouterLink} to={item.to} variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                                    {item.label}
                                </Link>
                            ) : (
                                <Typography variant="body2" color="text.secondary" aria-current={ultimo ? 'page' : undefined} sx={{ fontSize: '0.8125rem' }}>
                                    {item.label}
                                </Typography>
                            )}
                            {!ultimo && <ChevronRight size={14} aria-hidden style={{ opacity: 0.6 }} />}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
