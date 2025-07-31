import { EmbedBuilder } from "discord.js";
import { COLORS } from "../constants.js";

export const PYECHAN_AUTHOR = {
    name: "PyE Chan",
    iconURL:
        "https://cdn.discordapp.com/attachments/1115058778736431104/1282790824744321167/vecteezy_heart_1187438.png?ex=66e0a38d&is=66df520d",
    url: "https://cdn.discordapp.com/attachments/1115058778736431104/1282780704979292190/image_2.png",
};

export const PYECHAN_THUMBNAIL =
    "https://cdn.discordapp.com/attachments/1282932921203818509/1332238415676047430/pyechan.png";

export function createPyechanEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(COLORS.pyeLightBlue)
        .setAuthor(PYECHAN_AUTHOR)
        .setDescription(description)
        .setThumbnail(PYECHAN_THUMBNAIL)
        .setTimestamp()
        .setFooter({ text: "♥" });
}
