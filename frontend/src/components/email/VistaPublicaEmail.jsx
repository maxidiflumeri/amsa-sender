// src/pages/VistaEmail.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Box } from '@mui/material';

function VistaPublicaEmail() {
    const { id } = useParams(); // ID del ReporteEmail
    const [html, setHtml] = useState('');
    const [loading, setLoading] = useState(true);

    const obtenerHtml = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/mailing/vista/${id}`);
            setHtml(res.data.html);
        } catch (error) {
            console.error('Error al obtener el HTML:', error);
            setHtml('<p>Error al cargar el contenido.</p>');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        try {
            obtenerHtml()
        } catch (error) {
            console.error('Error al obtener el HTML:', error);
            setHtml('<p>Error al cargar el contenido.</p>');
        } finally {
            setLoading(false)
        }
    }, [id]);

    if (loading) return <p>Cargando vista previa...</p>;

    return (
        <Box sx={{ p: 2 }}>
            <Box dangerouslySetInnerHTML={{ __html: html }} />
        </Box>
    );
}

export default VistaPublicaEmail;
