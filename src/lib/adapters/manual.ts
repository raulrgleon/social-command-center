import { composeText, manual, type PublishInput, type SocialAdapter } from "@/lib/adapters/types";

function manualAdapter(platformId: string, message: string): SocialAdapter {
  return {
    platformId,
    async publish() {
      return manual(message);
    },
  };
}

export const snapchat = manualAdapter(
  "snapchat",
  "Snapchat no admite publicación automática de historias o Snaps. Usa el texto y los archivos preparados.",
);
export const whatsapp = manualAdapter(
  "whatsapp",
  "WhatsApp no tiene una API oficial para publicar en un muro o canal desde este escritorio. El envío de mensajes de la Cloud API es otro producto.",
);
export const messenger = manualAdapter(
  "messenger",
  "Messenger no tiene un muro donde publicar. El mensaje quedó preparado para enviarlo a mano.",
);
export const twitch = manualAdapter(
  "twitch",
  "Twitch no ofrece publicación de un post de muro. El texto quedó preparado para el panel del canal.",
);

export function preparedCopy(input: Pick<PublishInput, "title" | "body" | "hashtags" | "linkUrl">) {
  return composeText(input);
}
