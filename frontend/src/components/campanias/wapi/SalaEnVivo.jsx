import { useSalaSocket } from '../../../context/SocketContext';

/**
 * Entra a la sala de una campaña mientras está montado. Es un componente (y no un hook que recorre la lista) porque
 * los hooks no pueden ir en un loop: se monta uno por cada campaña que se está enviando y no dibuja nada.
 */
export default function SalaEnVivo({ id }) {
    useSalaSocket('join_campaña', id);
    return null;
}
