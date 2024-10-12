const { config } = require('dotenv');
config();

const { REST } = require('@discordjs/rest');
const { Routes, ApplicationCommandOptionType } = require('discord-api-types/v9');

const commands = [
    {
        name: 'abonner',
        description: 'Inscreva-se em uma URL de pesquisa',
        options: [
            {
                name: 'url',
                description: 'A URL da pesquisa Vinted',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'channel',
                description: 'O canal no qual você deseja enviar as notificações',
                type: ApplicationCommandOptionType.Channel,
                required: true
            }
        ]
    },
    {
        name: 'désabonner',
        description: 'Cancele a inscrição em uma URL de pesquisa',
        options: [
            {
                name: 'id',
                description: 'O identificador da assinatura (/abonnements)',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    {
        name: 'abonnements',
        description: 'Acesse a lista de todas as suas assinaturas',
        options: []
    }
];

const rest = new REST({ version: '9' }).setToken(process.env.VINTED_BOT_TOKEN);

(async () => {
    try {

        const { id: userId, username } = await rest.get(
            Routes.user()
        );

        console.log(`👋 Conectado como ${username}!`);

        const [ { id: guildId, name: guildName } ] = await rest.get(
            Routes.userGuilds()
        );

        console.log(`💻 Conectado ao ${guildName}!`);

        await rest.put(
            Routes.applicationGuildCommands(userId, guildId),
            { body: commands }
        ).then(console.log);

        console.log(`💻 Os comandos foram registrados no ${guildName}!`);
    } catch (error) {
        console.error(error);
    }
})();
