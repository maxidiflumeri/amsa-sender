import DialogoElegirSesiones from './campanias/waweb/DialogoElegirSesiones';
import ListaCampanias from './campanias/waweb/ListaCampanias';
import SubirCampaña from './SubirCampaña';
import EnviarMensajesModal from './EnviarMensajes';

// Campañas de WhatsApp Web (/campanias). La pantalla es la lista común de campañas; acá van solo las rutas y los
// datos propios del canal.

const UNIDAD = { singular: 'mensaje', plural: 'mensajes' };

// La lista de WhatsApp Web trae los contactos adentro de cada campaña.
const normalizar = (c) => ({ ...c, contactosCount: c.contactos?.length ?? 0 });

const cargarContactos = (campania) => campania.contactos ?? [];

export default function VerCampañas() {
    return (
        <ListaCampanias
            ruta="/campanias"
            subtitulo="Envíos de WhatsApp desde las sesiones conectadas, a partir de un CSV de números."
            urlLista="/whatsapp/campanias"
            normalizar={normalizar}
            apiBase="/whatsapp/campanias"
            eventoProgreso="progreso"
            tipoLog="whatsapp"
            puedePausar
            unidad={UNIDAD}
            SubirDialogo={SubirCampaña}
            EnviarDialogo={EnviarMensajesModal}
            ElegirSesionesDialogo={DialogoElegirSesiones}
            cargarContactos={cargarContactos}
            campoContacto="numero"
            etiquetaContacto="Número"
        />
    );
}
