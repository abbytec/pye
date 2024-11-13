import { Events, MessageReaction, User, Client, TextChannel, EmbedBuilder } from "discord.js";
import { StarBoard } from "../Models/StarBoard.ts";
import { StarMessage } from "../Models/StarMessage.ts";

export default {
    name: Events.MessageReactionAdd,

    async execute(client: Client, reaction: MessageReaction, user: User) {
        if (
            !reaction ||
            !user ||
            user?.bot ||
            reaction?.emoji?.name !== '⭐' ||
            !reaction?.message ||
            !reaction?.message?.guild ||
            reaction?.message?.author?.bot
        )
            return // Si no se cumple con algunos de los datos retorna undefined la función

        // Busca si el bot tiene configuración de la starboard
        let data = await StarBoard.findOne({ id: client.user?.id });
        if (!data) return console.error("No se encontró configuración de la starboard")

        // se asegura que está toda la información antes de ejecutarse
        return this.fetchStructure(reaction).then((reaction) => {
            this.checkReactions(reaction as MessageReaction, client, data); // Revisa las interacciones que tiene
        }).catch(() => null);
    },

    // Si la información es parcial se resuelve
    async fetchStructure(structure: MessageReaction) {
        return new Promise((resolve, reject) => {
            if (structure.partial) {
                structure.fetch()
                    .then((structure) => resolve(structure))
                    .catch((error) => reject(error))
            } else {
                resolve(structure)
            }
        })
    },

    async checkReactions(reaction: MessageReaction, client: Client, starboard: any) {
        const msg = reaction.message

        const guildId = reaction.message.guildId;
        if (!guildId) {
            console.error('No se encontró guild ID para enviar el mensaje.');
            return;
        }

        let messagePosted = await StarMessage.findOne({ msgId: msg.id }).exec(); // Revisar si ya fue publicado
        const postChannel = client.guilds.resolve(guildId)?.channels.cache.get(starboard.channel);
        if (!postChannel) {
            return console.error("No se encontró la starboard");
        }

        if (reaction.count >= starboard.stars) {
            if (messagePosted) {
                if (postChannel instanceof TextChannel) {
                    let embed = await postChannel.messages.fetch(messagePosted.responseId).catch(() => null)
                    if (!embed) return
                    embed.edit({
                        content: `**${reaction.count}** ⭐ ${msg.channel.toString()}`
                    }).catch(() => null)
                }
            } else {
                const msgLink = `https://discordapp.com/channels/${msg.guild?.id}/${msg.channel.id}/${msg.id}`
                const data = {
                    content: msg.content?.length && msg.content.length < 3920
                        ? msg.content
                        : `${msg.content?.substring(0, 3920)} **[ ... ]**`,
                    avatarURL: `https://cdn.discordapp.com/avatars/${msg.author?.id}/${msg.author?.avatar}.jpg`,
                    fields: {
                        name: 'Link del mensaje',
                        value: `[Ir allá](${msgLink})`
                    },
                    imageURL: "",
                }

                if (msg.embeds.length) {
                    const imgs = msg.embeds
                        .filter((embed) => embed.thumbnail || embed.image)  // Filtra aquellos embeds que contienen imagenes o miniaturas
                        .map((embed) => (embed.thumbnail ? embed.thumbnail.url : embed.image?.url));  // Obtiene la URL de la miniatura o la imagen
                    data.imageURL = imgs[0] || "";  // Asigna la primera imagen o miniatura encontrada
                    // twitch clip check
                    const videoEmbed = msg.embeds.find((embed) => embed.video)
                    if (videoEmbed && videoEmbed.video?.url.includes('clips.twitch.tv')) {
                        data.content += `\n⬇️ [Descarga el video](${videoEmbed.thumbnail?.url.replace('-social-preview.jpg', '.mp4')})`
                    }

                } else if (msg.attachments.size) {
                    data.imageURL = msg.attachments.first()?.url || ""
                    data.content += `\n📎 [${msg.attachments.first()?.name}](${msg.attachments.first()?.proxyURL})`
                }

                const embed = new EmbedBuilder()
                    .setAuthor({ name: msg.author?.username || "Undefined", iconURL: data.avatarURL })

                    .setDescription(data.content)
                    .setImage(data.imageURL)
                    .addFields([{
                        name: data.fields.name,
                        value: data.fields.value
                    }])
                    .setTimestamp()
                if (!postChannel || !(postChannel instanceof TextChannel)) {
                    console.error("No se encontró la starboard o no es un TextChannel válido");
                    return;
                }
                let m = await postChannel.send({ content: `**${reaction.count}** ⭐ ${msg.channel.toString()}`, embeds: [embed] }).catch(() => null)
                await StarMessage.create({ msgId: msg.id, responseId: m?.id }).catch(() => null)
            }

        }
    }
}