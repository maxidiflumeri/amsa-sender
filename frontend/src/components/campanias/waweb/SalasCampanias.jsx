import { useSalaSocket } from '../../../context/SocketContext';

// Entrar a la sala de cada campaña que está enviando, para recibir su avance y su log.

function Sala({ id }) {
    useSalaSocket('join_campaña', id);
    return null;
}

/** Una sala por campaña en proceso. Es un componente porque un hook no se puede llamar dentro de un `map`. */
export default function SalasCampanias({ campanias }) {
    const enProceso = campanias.filter((c) => c.estado === 'procesando' || c.estado === 'pausa_pendiente');
    return enProceso.map((c) => <Sala key={c.id} id={c.id} />);
}
