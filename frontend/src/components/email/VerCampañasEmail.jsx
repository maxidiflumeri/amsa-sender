import api from '../../api/axios';
import ListaCampanias from '../campanias/waweb/ListaCampanias';
import SubirCampañaModal from './SubirCampañaModal';
import EnviarMailsModal from './EnviarMails';

// Campañas de Email (/email/campanias). La pantalla es la lista común de campañas; acá van solo las rutas y los
// datos propios del canal. Email todavía no sabe pausar ni reanudar: el backend no tiene esas rutas.

const UNIDAD = { singular: 'mail', plural: 'mails' };

// La lista liviana trae el conteo en `_count`; el resto de la pantalla lee `contactosCount`.
const normalizar = (c) => ({ ...c, contactosCount: c._count?.contactos ?? 0 });

// Son todos los contactos de una vez (como siempre): la lista del diálogo los filtra y los virtualiza.
async function cargarContactos(campania) {
    const res = await api.get(`/email/campanias/${campania.id}/contactos`, { params: { page: 1, size: 1000000, q: '' } });
    return res.data.items;
}

export default function VerCampañasEmail() {
    return (
        <ListaCampanias
            ruta="/email/campanias"
            subtitulo="Envíos de email a partir de un CSV de contactos."
            urlLista="/email/campanias?lite=1"
            normalizar={normalizar}
            apiBase="/email/campanias"
            eventoProgreso="progreso_mail"
            tipoLog="email"
            puedePausar={false}
            unidad={UNIDAD}
            SubirDialogo={SubirCampañaModal}
            EnviarDialogo={EnviarMailsModal}
            cargarContactos={cargarContactos}
            campoContacto="email"
            etiquetaContacto="Email"
        />
    );
}
