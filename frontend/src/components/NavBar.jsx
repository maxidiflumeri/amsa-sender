import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

export default function Navbar() {
    const commonFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';

    return (
        <AppBar
            position="fixed"
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                backgroundColor: '#075E54', // verde WhatsApp
                fontFamily: commonFont,
            }}
        >
            <Toolbar>
                <Box display="flex" alignItems="center" sx={{ flexGrow: 1 }}>
                    <WhatsAppIcon sx={{ mr: 1, fontSize: 30 }} />
                    <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', fontFamily: commonFont }}>
                        WhatsApp Manager
                    </Typography>
                </Box>
                <Box>
                    <Button
                        color="inherit"
                        component={RouterLink}
                        to="/"
                        sx={{ fontFamily: commonFont, textTransform: 'none' }}
                    >
                        Sesiones
                    </Button>
                    <Button
                        color="inherit"
                        component={RouterLink}
                        to="/conectar"
                        sx={{ fontFamily: commonFont, textTransform: 'none' }}
                    >
                        Conectar
                    </Button>
                    {/* <Button
            color="inherit"
            component={RouterLink}
            to="/subir-campania"
            sx={{ fontFamily: commonFont, textTransform: 'none' }}
          >
            Subir Campaña
          </Button> */}
                    <Button
                        color="inherit"
                        component={RouterLink}
                        to="/campanias"
                        sx={{ fontFamily: commonFont, textTransform: 'none' }}
                    >
                        Campañas
                    </Button>
                    {/* <Button
            color="inherit"
            component={RouterLink}
            to="/enviar"
            sx={{ fontFamily: commonFont, textTransform: 'none' }}
          >
            Enviar
          </Button> */}
                    <Button
                        color="inherit"
                        component={RouterLink}
                        to="/reportes"
                        sx={{ fontFamily: commonFont, textTransform: 'none' }}
                    >
                        Reportes
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
}