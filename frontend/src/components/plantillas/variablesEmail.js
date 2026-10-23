// Las variables que las campañas de email pueden usar en el asunto y en el diseño ({{nombre}}, {{deuact}}…).
// Antes la lista estaba copiada en CrearTemplate y en EditorTemplate, y las dos se desactualizaban por separado.
export const VARIABLES_EMAIL = [
    'mail', 'nombre', 'id_contacto', 'Telefono_1', 'Telefono_2', 'direccion',
    'ciudad', 'Empresa', 'deuhist', 'deuact', 'Filer', 'Nroemp', 'remesa',
    'Cuitdoc', 'Codemp2', 'codpos', 'f_recepc', 'f_cierre', 'Usercode2',
    'Usercode3', 'Usercode4', 'usernum0', 'usernum1', 'usernum2', 'codbar',
    'codbar_2', 'Usercode1', 'co1', 'userfec5',
];

export const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
