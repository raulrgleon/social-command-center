# Integraciones

Mesa muestra las 20 redes desde el primer día. Una red solo queda conectada cuando su autorización oficial termina. Las cuentas de demostración tienen estado `DEMO` y cualquier envío se registra como `MANUAL_REQUIRED`, nunca como publicado.

El adaptador llama al endpoint documentado por la plataforma. Si la respuesta no trae un identificador, el resultado no es éxito. Un corte de tiempo queda como incierto y no se reintenta solo, para no duplicar la pieza.

## Publicación oficial preparada

Hace falta crear la app en el portal de cada red, poner la URL de retorno `{APP_URL}/api/integrations/{id}/callback` y rellenar las variables del servidor. Sin esas variables, el botón de conectar dice exactamente cuáles faltan.

| Red | Qué publica | Qué falta para usarla |
| --- | --- | --- |
| Facebook | Posts de Página (Graph API). Los perfiles personales no tienen publicación para terceros. | App de Meta, `FACEBOOK_APP_ID` y `FACEBOOK_APP_SECRET`, permiso de Páginas y revisión si se usa fuera de los administradores de la app. |
| Instagram | Contenido de una cuenta profesional vinculada a una Página. | Las mismas claves de Meta, la cuenta profesional y una imagen en URL pública (`S3_PUBLIC_BASE_URL`). Un archivo solo local no se envía. |
| Threads | Posts de la Threads API. | `THREADS_APP_ID` y `THREADS_APP_SECRET`, con el caso de uso de Threads aprobado. |
| LinkedIn | Posts del miembro (Posts API). | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` y `LINKEDIN_API_VERSION` con una versión que LinkedIn siga aceptando. Publicar como página de empresa pide `w_organization_social`, sujeto a revisión. |
| X | Posts de la API v2, con tope de 280 caracteres. | `X_CLIENT_ID` y `X_CLIENT_SECRET`. El permiso de escritura depende del plan de pago de la app. |
| YouTube | Videos (Data API). La pestaña Comunidad no tiene API. | `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, y el alcance de subida de YouTube. |
| TikTok | Content Posting API. El envío solo se confirma si el estado es `PUBLISH_COMPLETE`. | `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET`. Publicar fuera de la cuenta de prueba exige la revisión de TikTok. |
| Pinterest | Pines de la API v5. | `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, un tablero y una imagen con URL pública. |
| Reddit | Envíos de texto o enlace. | `REDDIT_CLIENT_ID` y `REDDIT_CLIENT_SECRET`. El subreddit queda como identificador de la cuenta. |
| Tumblr | Posts de texto en la API v2. | `TUMBLR_CONSUMER_KEY` y `TUMBLR_CONSUMER_SECRET`, y el identificador del blog. |
| VK | `wall.post`. | `VK_APP_ID` y `VK_APP_SECRET`. El identificador es el usuario o la comunidad (con signo menos si es comunidad). |
| WeChat | Borradores de una cuenta oficial. Los Momentos no tienen API de terceros. | `WECHAT_APP_ID` y `WECHAT_APP_SECRET`, y una cuenta oficial verificada. Mesa no inicia el OAuth de usuario de Momentos. |

## Conexión por token, sin OAuth de Mesa

Estas redes se comprueban en vivo al guardarlas. Si la comprobación falla, la cuenta no se crea.

| Red | Credencial | Comprobación |
| --- | --- | --- |
| Telegram | Token de bot y chat | `getMe` |
| Discord | URL de webhook del canal | Lectura del webhook. El envío exige el identificador que Discord devuelve. |
| Bluesky | Identificador y contraseña de aplicación | `createSession`. No uses la contraseña principal. |
| Mastodon | URL de la instancia y token | `verify_credentials` |

## Solo manual

Snapchat, WhatsApp, Messenger y Twitch no tienen una API pública para publicar el contenido orgánico que Mesa prepara (historias, muro, canales o un post de perfil). Sus adaptadores no llaman a la red. El resultado es `NOT_COMPATIBLE` y el escritorio muestra el texto y los archivos para publicarlos a mano.

WhatsApp Cloud API y la Send API de Messenger sirven para conversaciones, no para un muro. La Marketing API de Snapchat sirve para anuncios. La API de Twitch administra la transmisión, no un post.

## Métricas

Las métricas de alcance, impresiones e interacciones solo se guardan cuando el adaptador las recibe de la API. La analítica no rellena ceros para simular un resultado. Si una cuenta no se ha sincronizado, la cifra aparece como no disponible o pendiente.

## Renovación

Si `tokenExpiresAt` ya pasó, el envío no sale: la cuenta pasa a `NEEDS_REAUTH`. Mesa todavía no renueva el token en segundo plano. Hay que volver a conectar la cuenta. Un reintento solo ocurre si el intento anterior falló, no tiene identificador externo, es reintentable y no supera cinco intentos.
