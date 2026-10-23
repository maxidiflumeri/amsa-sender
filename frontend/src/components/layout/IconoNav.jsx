import {
    House,
    Mail,
    MessageCircle,
    MessagesSquare,
    Send,
    ShieldCheck,
    SlidersHorizontal,
    Smartphone,
    UserRound,
    Users,
} from 'lucide-react';

/** Los íconos de Lucide que puede pedir `navConfig` (campo `icon`), y el buscador para Mi perfil. */
const iconosNav = {
    House,
    MessagesSquare,
    Users,
    MessageCircle,
    Mail,
    Smartphone,
    SlidersHorizontal,
    ShieldCheck,
    Send,
    UserRound,
};

export default function IconoNav({ nombre, size = 20 }) {
    const Componente = (nombre && iconosNav[nombre]) || House;
    return <Componente size={size} strokeWidth={1.75} aria-hidden />;
}
