import Discord, { TextChannel } from 'discord.js';
const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS]
});

import vinted from 'vinted-api';
import { initialize, Subscription } from './database';
import { getConnection } from 'typeorm';

const adminIDs = process.env.VINTED_BOT_ADMIN_IDS?.split(',')!;

let isFirstSync = true;
let lastFetchFinished = true;

initialize();

const syncSubscription = (subscriptionData: Subscription) => {
    return new Promise<void>((resolve) => {
        vinted.search(subscriptionData.url, false, false, {
            per_page: '20'
        }).then((res) => {
            if (!res.items) {
                console.log('Busca concluída, mas recebeu uma resposta errada. Promessa resolvida.', res);
                resolve();
                return;
            }
            const lastItemTimestamp = subscriptionData.latestItemDate?.getTime();
            const items = res.items
                .sort((a, b) => new Date(b.photo.high_resolution.timestamp).getTime() - new Date(a.photo.high_resolution.timestamp).getTime())
                .filter((item) => !lastItemTimestamp || new Date(item.photo.high_resolution.timestamp).getTime() > lastItemTimestamp);

            if (!items.length) return void resolve();

            const newLastItemDate = new Date(items[0].photo.high_resolution.timestamp);
            if (!lastItemTimestamp || newLastItemDate.getTime() > lastItemTimestamp) {
                getConnection().manager.getRepository(Subscription).update({
                    id: subscriptionData.id
                }, {
                    latestItemDate: newLastItemDate
                });
            }

            const itemsToSend = ((lastItemTimestamp && !isFirstSync) ? items.reverse() : [items[0]]);

            for (let item of itemsToSend) {
                const embed = new Discord.MessageEmbed()
                    .setTitle(item.title)
                    .setURL(item.url)
                    .setImage(item.photo.url)
                    .setColor('#09B1BA')
                    .setTimestamp(new Date(item.photo.high_resolution.timestamp))
                    .setFooter(`Artigo relacionado à pesquisa: ${subscriptionData.id}`)
                    .addField('Preço', item.price || 'vazio', true)
                    .addField('Tamanho', item.size_title || 'vazio', true);
                (client.channels.cache.get(subscriptionData.channelId) as TextChannel).send({ embeds: [embed], components: [
                    new Discord.MessageActionRow()
                        .addComponents([
                            new Discord.MessageButton()
                                .setLabel('Detalhes')
                                .setURL(item.url)
                                .setEmoji('🔎')
                                .setStyle('LINK'),
                            new Discord.MessageButton()
                                .setLabel('Comprar')
                                .setURL(`https://www.vinted.fr/transaction/buy/new?source_screen=item&transaction%5Bitem_id%5D=${item.id}`)
                                .setEmoji('💸')
                                .setStyle('LINK')
                        ])
                ] });
            }

            if (itemsToSend.length > 0) {
                console.log(`👕 ${itemsToSend.length} ${itemsToSend.length > 1 ? 'novos artigos encontrados' : 'novo artigo encontrado'} para a pesquisa ${subscriptionData.id}!\n`)
            }

            resolve();
        }).catch((e) => {
            console.error('A busca retornou um erro. Promessa resolvida.', e);
            resolve();
        });
    });
};

const sync = async () => {

    if (!lastFetchFinished) return;
    lastFetchFinished = false;

    setTimeout(() => {
        lastFetchFinished = true;
    }, 20_000);

    console.log(`🤖 Sincronizando com o Vinted...\n`);

    const subscriptions = await getConnection().manager.getRepository(Subscription).find({
        isActive: true
    });
    const promises = subscriptions.map((sub) => syncSubscription(sub));
    Promise.all(promises).then(() => {
        isFirstSync = false;
        lastFetchFinished = true;
    });

};

client.on('ready', () => {
    console.log(`🔗 Conectado na conta de ${client.user!.tag}!\n`);

    isFirstSync = true;

    const messages = [
        `🕊️ Este projeto livre e gratuito demanda tempo. Se você puder, não hesite em apoiar o desenvolvimento com uma doação! https://paypal.me/andr0z\n`,
        `🤟 Você sabia? Oferecemos nossa própria versão do bot online 24/24 7/7, sem que você precise se preocupar com nada! https://distrobot.fr\n`
    ];
    let idx = 0;
    const donate = () => console.log(messages[idx % 2]);
    setTimeout(() => {
        donate();
    }, 3000);
    setInterval(() => {
        idx++;
        donate();
    }, 120_000);

    sync();
    setInterval(sync, 15000);

    client.user!.setActivity(`Vinted BOT | v3 Docker 🐳`);
});

client.on('interactionCreate', async (interaction) => {

    if (!interaction.isCommand()) return;
    if (!adminIDs.includes(interaction.user.id)) return void interaction.reply(`:x: Você não tem permissão para realizar esta ação!`);

    switch (interaction.commandName) {
        case 'abonner': {
            const sub: Partial<Subscription> = {
                url: interaction.options.getString('url')!,
                channelId: interaction.options.getChannel('channel')!.id,
                createdAt: new Date(),
                isActive: true
            }
            getConnection().manager.getRepository(Subscription).save(sub);
            interaction.reply(`:white_check_mark: Sua assinatura foi criada com sucesso!\n**URL**: <${sub.url}>\n**Canal**: <#${sub.channelId}>`);
            break;
        }
        case 'désabonner': {
            const subID = interaction.options.getString('id')!;
            const subscription = await getConnection().manager.getRepository(Subscription).findOne({
                isActive: true,
                id: parseInt(subID)
            });
            if (!subscription) {
                return void interaction.reply(':x: Nenhuma assinatura encontrada para sua pesquisa...');
            }
            getConnection().manager.getRepository(Subscription).update({
                id: subscription.id
            }, {
                isActive: false
            });
            interaction.reply(`:white_check_mark: Assinatura removida com sucesso!\n**URL**: <${subscription.url}>\n**Canal**: <#${subscription.channelId}>`);
            break;
        }
        case 'abonnements': {
            const subscriptions = await getConnection().manager.getRepository(Subscription).find({
                isActive: true
            });
            const chunks: string[][] = [[]];

            subscriptions.forEach((sub) => {
                const content = `**ID**: ${sub.id}\n**URL**: ${sub.url}\n**Canal**: <#${sub.channelId}>\n`;
                const lastChunk = chunks.shift()!;
                if ((lastChunk.join('\n').length + content.length) > 1024) {
                    if (lastChunk) chunks.push(lastChunk);
                    chunks.push([content]);
                } else {
                    lastChunk.push(content);
                    chunks.push(lastChunk);
                }
            });

            interaction.reply(`:white_check_mark: **${subscriptions.length}** assinaturas estão ativas!`);

            chunks.forEach((chunk) => {
                const embed = new Discord.MessageEmbed()
                    .setColor('RED')
                    .setAuthor(`Use o comando /désabonner para remover uma assinatura!`)
                    .setDescription(chunk.join('\n'));

                interaction.channel!.send({ embeds: [embed] });
            });
        }
    }
});

client.login(process.env.VINTED_BOT_TOKEN);
