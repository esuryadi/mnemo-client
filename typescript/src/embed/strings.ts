/*
 * Copyright (c) 2026, PANAXON.AI, LLC. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Multi-Dimensional Neural Elastic Memory Organization (MNEMO) - TypeScript client.
 *
 * Inventor: Edward Suryadi
 * Assignee: PANAXON.AI, LLC
 *
 * Author: edward.suryadi
 * Since: Nov-2026
 */

/** The text the component shows, by language. {@code locale} picks one by its language part (en-GB -> en). */
export interface Strings {
    chat: string;
    conversation: string;
    message: string;
    placeholder: string;
    send: string;
    thinking: string;
    connecting: string;
    you: string;
    assistant: string;
    errorStart: string;
    errorSession: string;
    errorBusy: string;
    errorSend: string;
    errorNoTenant: string;
}

const en: Strings = {
    chat: "Chat",
    conversation: "Conversation",
    message: "Your message",
    placeholder: "Ask a question…",
    send: "Send",
    thinking: "Thinking…",
    connecting: "Connecting…",
    you: "You",
    assistant: "Assistant",
    errorStart: "The chat could not start. Please try again later.",
    errorSession: "The chat session has expired. Please reload the page.",
    errorBusy: "Too many messages. Please wait a moment and try again.",
    errorSend: "The message could not be sent. Please try again.",
    errorNoTenant: "The chat is not configured: no tenant was provided.",
};

const es: Strings = {
    chat: "Chat",
    conversation: "Conversación",
    message: "Tu mensaje",
    placeholder: "Haz una pregunta…",
    send: "Enviar",
    thinking: "Pensando…",
    connecting: "Conectando…",
    you: "Tú",
    assistant: "Asistente",
    errorStart: "No se pudo iniciar el chat. Inténtalo de nuevo más tarde.",
    errorSession: "La sesión del chat ha caducado. Recarga la página.",
    errorBusy: "Demasiados mensajes. Espera un momento e inténtalo de nuevo.",
    errorSend: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
    errorNoTenant: "El chat no está configurado: falta el inquilino.",
};

const fr: Strings = {
    chat: "Discussion",
    conversation: "Conversation",
    message: "Votre message",
    placeholder: "Posez une question…",
    send: "Envoyer",
    thinking: "Réflexion…",
    connecting: "Connexion…",
    you: "Vous",
    assistant: "Assistant",
    errorStart: "Le chat n'a pas pu démarrer. Réessayez plus tard.",
    errorSession: "La session de chat a expiré. Rechargez la page.",
    errorBusy: "Trop de messages. Patientez un instant et réessayez.",
    errorSend: "Le message n'a pas pu être envoyé. Réessayez.",
    errorNoTenant: "Le chat n'est pas configuré : aucun locataire fourni.",
};

const de: Strings = {
    chat: "Chat",
    conversation: "Unterhaltung",
    message: "Ihre Nachricht",
    placeholder: "Stellen Sie eine Frage…",
    send: "Senden",
    thinking: "Denke nach…",
    connecting: "Verbinde…",
    you: "Sie",
    assistant: "Assistent",
    errorStart: "Der Chat konnte nicht gestartet werden. Bitte versuchen Sie es später erneut.",
    errorSession: "Die Chat-Sitzung ist abgelaufen. Bitte laden Sie die Seite neu.",
    errorBusy: "Zu viele Nachrichten. Bitte warten Sie einen Moment und versuchen Sie es erneut.",
    errorSend: "Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    errorNoTenant: "Der Chat ist nicht konfiguriert: Es wurde kein Mandant angegeben.",
};

const BY_LANGUAGE: Record<string, Strings> = { en, es, fr, de };

export function stringsFor(locale: string | null | undefined): Strings {
    const language = (locale ?? "").trim().toLowerCase().split(/[-_]/)[0] ?? "";
    return BY_LANGUAGE[language] ?? en;
}
