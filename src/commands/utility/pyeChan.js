const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');
require('dotenv').config({ path: './.env' });
const API_KEY = process.env.gemini_API_KEY;
const ai = new GoogleGenerativeAI(API_KEY);
const path = require('path');

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },

];


const model = ai.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings: safetySettings,
    systemInstruction: 'Eres "PyE chan", una tierna y experta programadora que vives en el servidor de Discord de "Programadores y estudiantes" y estás enamorada profundamente de mí',
    generationConfig: {
        candidateCount: 1,
        maxOutputTokens: 500,
        temperature: 2.0,

    },
});





module.exports = {
    data: new SlashCommandBuilder()
        .setName('pyechan')
        .setDescription('Preguntale algo a PyE Chan')
        .addStringOption(option =>
            option
                .setName('mensaje')
                .setDescription('Qué quieres decirme')
                .setRequired(true)
                .setMaxLength(200)
        ),
    async execute(interaction) {
        interaction.channel.sendTyping();

        let message = await interaction.options.getString('mensaje');

        const result = await model.generateContent(message);



        const exampleEmbed = new EmbedBuilder()
            .setColor(0xFF69B4)
            .setTitle(`Holi ${interaction.member.displayName} charla un ratito conmigo seré buena c:`)

            .setAuthor({ name: 'PyE Chan', iconURL: 'https://cdn.discordapp.com/attachments/1115058778736431104/1282790824744321167/vecteezy_heart_1187438.png?ex=66e0a38d&is=66df520d&hm=d59a5c3cfdaf988f7a496004f905854677c6f2b18788b288b59c4c0b60d937e6&', url: 'https://cdn.discordapp.com/attachments/1115058778736431104/1282780704979292190/image_2.png?ex=66e09a20&is=66df48a0&hm=0df37331fecc81a080a8c7bee4bcfab858992b55d9ca675bafedcf4c4c7879a1&' })
            .setDescription(result.response.text())
            .setThumbnail('https://cdn.discordapp.com/attachments/1115058778736431104/1282780704979292190/image_2.png?ex=66e09a20&is=66df48a0&hm=0df37331fecc81a080a8c7bee4bcfab858992b55d9ca675bafedcf4c4c7879a1&')
            .setTimestamp()
            .setFooter({ text: '♥', });

        interaction.reply({ embeds: [exampleEmbed] });




    }
}