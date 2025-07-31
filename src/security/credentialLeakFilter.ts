import { Message, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.js";
import { getChannelFromEnv } from "../utils/constants.js";

const credentialPatterns: RegExp[] = [
    /AKIA[0-9A-Z]{16}/g, // AWS Access Key ID
    /ASIA[0-9A-Z]{16}/g, // AWS Temporary Access Key ID
    /A3T[A-Z0-9]{16}/g,  // AWS GovCloud or others
    /AIza[0-9A-Za-z\-_]{35}/g, // Google API Key
];

export async function checkCredentialLeak(message: Message<boolean>, client: ExtendedClient) {
    if (!message.content) return false;
    const detected = credentialPatterns.some((rgx) => rgx.test(message.content));
    if (!detected) return false;

    const warnMsg =
        `⚠️ Hola ${message.author}, parece que tu mensaje en <#${message.channel.id}> ` +
        `podría contener credenciales (tokens o claves). ` +
        `Te recomendamos editar o borrar el mensaje para proteger tu información.`;

    let dmSuccess = true;
    await message.author.send({ content: warnMsg }).catch(() => {
        dmSuccess = false;
    });

    if (!dmSuccess) {
        const logChannel = client.channels.cache.get(getChannelFromEnv("logMessages")) as TextChannel | null;
        await logChannel?.send({
            content: `No se pudo advertir por MD a <@${message.author.id}> sobre posibles credenciales filtradas. [Mensaje](${message.url})`,
        }).catch(() => null);
    }
    return true;
}
