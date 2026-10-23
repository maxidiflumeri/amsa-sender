import { Fragment } from 'react';
import {
    Box,
    Paper,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * Tabla en la computadora, tarjetas en el celular (debajo de `md`), igual que en AMSA Gestión. Nunca fuerza un ancho
 * mínimo: en el celular no hay scroll horizontal.
 *
 * @param {object} props
 * @param {Array<{key: string, label: React.ReactNode, render?: (row: any) => React.ReactNode, primary?: boolean,
 *   secondary?: boolean, hideInCard?: boolean, align?: 'left'|'center'|'right', width?: number|string,
 *   hideBelow?: 'lg'|'xl'}>} props.columns `primary` es el título de la tarjeta y `secondary` el renglón de abajo.
 *   `hideBelow` oculta la columna de la tabla debajo de ese ancho (en la tarjeta se sigue viendo).
 * @param {any[]} props.rows
 * @param {(row: any) => string|number} [props.rowKey]
 * @param {(row: any) => void} [props.onRowClick]
 * @param {(row: any) => React.ReactNode} [props.acciones] La última columna en la tabla; el pie de la tarjeta.
 * @param {boolean} [props.loading] Muestra filas o tarjetas de esqueleto.
 * @param {React.ReactNode} [props.empty] Lo que se muestra sin filas (un EmptyState).
 * @param {string} [props.ariaLabel]
 */
export default function DataTableResponsive({
    columns,
    rows,
    rowKey,
    onRowClick,
    acciones,
    loading = false,
    skeletonRows = 5,
    empty,
    ariaLabel,
    size = 'medium',
}) {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

    const keyDe = (row, i) => (rowKey ? rowKey(row) : row.id ?? i);
    const valor = (col, row) => (col.render ? col.render(row) : row[col.key] ?? '—');
    const primary = columns.find((c) => c.primary);
    const secondary = columns.find((c) => c.secondary);
    const detalle = columns.filter((c) => !c.primary && !c.secondary && !c.hideInCard);
    const ocultar = (col) => (col.hideBelow ? { display: { xs: 'none', [col.hideBelow]: 'table-cell' } } : undefined);

    if (!loading && rows.length === 0) {
        return empty ?? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="body2" color="text.secondary">No hay datos para mostrar</Typography>
            </Box>
        );
    }

    if (isDesktop) {
        return (
            <TableContainer>
                <Table size={size} aria-label={ariaLabel}>
                    <TableHead>
                        <TableRow>
                            {columns.map((col) => (
                                <TableCell key={col.key} align={col.align ?? 'left'} width={col.width} sx={ocultar(col)}>
                                    {col.label}
                                </TableCell>
                            ))}
                            {acciones && <TableCell align="right"><Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Acciones</Box></TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading
                            ? Array.from({ length: skeletonRows }).map((_, i) => (
                                <TableRow key={`esq-${i}`}>
                                    {columns.map((col) => (
                                        <TableCell key={col.key} sx={ocultar(col)}><Skeleton width={col.primary ? '70%' : '50%'} /></TableCell>
                                    ))}
                                    {acciones && <TableCell />}
                                </TableRow>
                            ))
                            : rows.map((row, i) => (
                                <TableRow
                                    key={keyDe(row, i)}
                                    hover={!!onRowClick}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    sx={{ cursor: onRowClick ? 'pointer' : 'default', '&:last-child td': { borderBottom: 0 } }}
                                >
                                    {columns.map((col) => (
                                        <TableCell key={col.key} align={col.align ?? 'left'} sx={ocultar(col)}>
                                            {valor(col, row)}
                                        </TableCell>
                                    ))}
                                    {acciones && (
                                        <TableCell align="right" onClick={(e) => e.stopPropagation()} sx={{ whiteSpace: 'nowrap', py: 0.5 }}>
                                            {acciones(row)}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }

    if (loading) {
        return (
            <Stack spacing={1.5} sx={{ p: { xs: 1.5, sm: 2 } }}>
                {Array.from({ length: Math.min(skeletonRows, 4) }).map((_, i) => (
                    <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                        <Skeleton width="60%" />
                        <Skeleton width="40%" />
                        <Skeleton width="80%" />
                    </Paper>
                ))}
            </Stack>
        );
    }

    return (
        <Stack spacing={1.5} component="ul" aria-label={ariaLabel} sx={{ listStyle: 'none', m: 0, p: { xs: 1.5, sm: 2 } }}>
            {rows.map((row, i) => (
                <Box component="li" key={keyDe(row, i)}>
                    <Paper
                        variant="outlined"
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        sx={{ borderRadius: '14px', p: 2, cursor: onRowClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 1 }}
                    >
                        {primary && (
                            <Box sx={{ fontWeight: 600, fontSize: 15, overflowWrap: 'anywhere' }}>{valor(primary, row)}</Box>
                        )}
                        {secondary && (
                            <Box sx={{ color: 'text.secondary', fontSize: 13.5 }}>{valor(secondary, row)}</Box>
                        )}
                        {detalle.length > 0 && (
                            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.25 }}>
                                {detalle.map((col) => (
                                    <Fragment key={col.key}>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Box component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>{col.label}</Box>
                                            <Box component="dd" sx={{ m: 0, fontSize: 14, overflowWrap: 'anywhere' }}>{valor(col, row)}</Box>
                                        </Box>
                                    </Fragment>
                                ))}
                            </Box>
                        )}
                        {acciones && (
                            <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pt: 0.5, '& .MuiButton-root': { minHeight: 44 }, '& .MuiIconButton-root': { width: 44, height: 44 } }}>
                                {acciones(row)}
                            </Box>
                        )}
                    </Paper>
                </Box>
            ))}
        </Stack>
    );
}
