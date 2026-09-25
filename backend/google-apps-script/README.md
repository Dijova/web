# Backend del formulario de cotización (Google Apps Script)

El formulario de `index.html` envía las solicitudes a un Web App de Google Apps
Script que las guarda en una hoja de cálculo **privada** de Google Sheets y
avisa por correo al negocio. No requiere servidor propio y funciona con
cualquier hosting estático (GitHub Pages, Netlify, etc.).

## Instalación / actualización

1. Crea (o abre) la hoja de cálculo donde quieres guardar las solicitudes.
   **No la compartas públicamente**: solo las personas del negocio deben tener acceso.
2. En la hoja: **Extensiones → Apps Script**. Si ya existía un script para el
   formulario, reemplaza todo su contenido por `Code.gs` de esta carpeta.
3. **Configuración del proyecto (⚙) → Propiedades del script** y agrega:
   | Propiedad          | Obligatoria | Valor |
   |--------------------|-------------|-------|
   | `NOTIFY_EMAIL`     | recomendada | Correo que recibe el aviso de cada solicitud (p. ej. `info@sgmcleansolutions.com`). |
   | `SHEET_ID`         | no          | ID de la hoja si el script **no** está vinculado a ella. |
   | `TURNSTILE_SECRET` | no          | Clave secreta de Cloudflare Turnstile (ver abajo). |
4. **Implementar → Gestionar implementaciones**:
   - Si ya había una implementación: edítala (✏) → *Versión: Nueva versión* →
     **Implementar**. Así la URL no cambia y no hay que tocar `config.js`.
   - Si es nueva: **Nueva implementación → Aplicación web**, *Ejecutar como: Yo*,
     *Quién tiene acceso: Cualquier persona*. Copia la URL `/exec` en
     `FORM_ENDPOINT` de `config.js`.
5. Autoriza los permisos que pide Google (Sheets y envío de correo).
6. Prueba el formulario en la web. La primera solicitud crea la pestaña
   `Quotes` con los encabezados.

> "Cualquier persona" solo permite **enviar** solicitudes. El endpoint nunca
> devuelve datos guardados (`doGet` responde únicamente `{"result":"ok"}`), y la
> hoja sigue siendo privada.

## Anti-bots opcional: Cloudflare Turnstile (gratuito)

1. Crea un widget en <https://dash.cloudflare.com> → Turnstile, con el dominio de la web.
2. Pon la **site key** en `TURNSTILE_SITE_KEY` de `config.js`.
3. Pon la **secret key** en la propiedad `TURNSTILE_SECRET` del script y
   publica una nueva versión.

Sin estas claves el formulario sigue protegido con honeypot, tiempo mínimo de
llenado y límite de envíos.

## Medidas de seguridad implementadas

| Riesgo | Mitigación |
|--------|-----------|
| Datos expuestos | Se guardan en una hoja privada; el endpoint no permite leerlos. Conexión HTTPS obligatoria. |
| Uso del formulario para phishing | Se rechazan enlaces y HTML en los campos. El correo de aviso es texto plano, con enlaces "desactivados" (`hxxps[://]ejemplo[.]com`) y un aviso de seguridad. **No** se envía respuesta automática al correo ingresado, así nadie puede usar el formulario para mandar correos a terceros. |
| Inyección de fórmulas en Sheets (`=HYPERLINK`, `=IMPORTXML`…) | Las celdas se guardan como texto y los valores que empiezan por `= + - @` se neutralizan. |
| XSS / scripts inyectados | Se eliminan etiquetas HTML y caracteres invisibles; la página usa `textContent` para mostrar mensajes y una Content-Security-Policy estricta. |
| Spam y bots | Campo honeypot, tiempo mínimo de 3 s, Turnstile opcional, límite de 3 envíos/hora por correo y 60 cada 10 min en total. |
| Datos inválidos | Validación en el navegador **y** en el servidor (lista blanca de servicios e idiomas, longitudes máximas, formato de correo/teléfono). |
| Envíos simultáneos | `LockService` evita que dos escrituras se pisen. |
| Filtración de errores | El servidor responde con códigos genéricos; los detalles solo quedan en los logs de Apps Script. |

## Recomendaciones adicionales

- Activa la verificación en 2 pasos en la cuenta de Google dueña de la hoja.
- Revisa periódicamente quién tiene acceso a la hoja y borra solicitudes antiguas
  que ya no necesites.
- Si publicas la web en un hosting que permita cabeceras HTTP (Netlify,
  Cloudflare Pages…), añade también `X-Frame-Options: DENY` /
  `frame-ancestors 'none'` y `Strict-Transport-Security`.
