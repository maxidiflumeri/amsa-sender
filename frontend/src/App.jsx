import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';
import Navbar from './components/Navbar';
import ConectarSesion from './components/ConectarSesion';
import EstadoSesiones from './components/EstadoSesiones';
import SubirCampaña from './components/SubirCampaña';
import EnviarMensajes from './components/EnviarMensajes';
import VerReportes from './components/VerReportes';
import VerCampañas from './components/VerCampañas';

export default function App() {
  return (
    <>
      <Navbar />
      
      <Container sx={{ mt: 10 }}>
        <Routes>
          <Route path="/" element={<EstadoSesiones />} />
          <Route path="/conectar" element={<ConectarSesion />} />
          <Route path="/subir-campania" element={<SubirCampaña />} />
          <Route path="/campanias" element={<VerCampañas />} />
          <Route path="/enviar" element={<EnviarMensajes />} />
          <Route path="/reportes" element={<VerReportes />} />
        </Routes>
      </Container>
    </>
  );
}