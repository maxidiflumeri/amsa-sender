export function renderTemplate(template: string, datos: Record<string, any>): string {
    if (!template) return '';

    return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
        const value = datos[key];
        return value !== undefined && value !== null ? String(value) : '';
    });
}

export function insertHeaderAndFooter(html: string, verEnNavegadorUrl: string, urlDesuscribirse: string) {    

    // 🔧 Insertar encabezado y footer al HTML original
    const htmlFinal = `
      <div style="text-align: center; font-size: 12px; color: #888; margin-top: 10px;">
        <a href="${verEnNavegadorUrl}" target="_blank" style="color: #888;">Ver en mi navegador</a>
      </div>
      ${html}
      <hr style="margin-top: 40px; border: none; border-top: 1px solid #ccc;" />
      <div style="font-size: 11px; color: #666; text-align: center; padding: 20px;">
        <div>              
          <a href="${urlDesuscribirse}" data-no-track="1" rel="nofollow noopener" style="margin-left: 10px; color: #666;">Desuscribite</a>
        </div>
        <p style="margin: 10px 0;">
          Recibes este mail porque estás suscripto a nuestra lista de correos.<br />
          Ana Maya S.A. - Dirección - Ciudad - Provincia - Argentina<br />
          <a href="https://www.anamayasa.com.ar" style="color: #666;">www.anamayasa.com.ar</a>
        </p>
        <p style="font-size: 10px; color: #999;">
          Mensaje enviado automáticamente desde AMSA Sender
        </p>
      </div>
    `;

    return htmlFinal;
}