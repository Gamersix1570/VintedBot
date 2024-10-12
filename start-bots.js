const exec = require('child_process').exec;
const bots = require('./bots.json');

const recreate = () => {

    console.log(`🐳 Verificando volumes existentes...`);

    exec(`docker volume ls -q`, (err, stdout, stderr) => {

        const volumes = stdout.split('\n');

        bots.forEach((bot) => {
            console.log(`🐋 Iniciando ${bot.name}...`);

            const start = () => {
                exec(`BOT=${bot.name} VINTED_BOT_ADMIN_IDS=${bot.adminIDs} VINTED_BOT_TOKEN=${bot.token} docker-compose -f docker-compose.yaml -p bot-${bot.name} up -d`, (err, stdout, stderr) => {
                    if (err) {
                        console.error(`🐋 ${bot.name} falhou ao iniciar.`);
                        console.error(err);
                        return;
                    }
                    console.log(stderr);
                });
            }
            
            if (volumes.includes(`bot-${bot.name}`)) {
                console.log(`📦 O banco de dados ${bot.name} foi recuperado!`);
                start();
            } else {
                exec(`docker volume create bot-${bot.name}`, (err, stdout, stderr) => {
                    if (!err) {
                        console.log(`📦 O banco de dados ${bot.name} foi criado!`);
                        start();
                    } else console.error(err);
                });
            }
            
        });

    });

};

const restart = process.argv.includes('-restart');

if (restart) {
    console.log('👋 Desligando todos os bots...');
    bots.forEach((bot) => {
        exec(`docker-compose -p bot-${bot.name} stop`, (err, stdout, stderr) => {
            if (!err) {
                exec(`docker-compose -p bot-${bot.name} rm -f`, (err, stdout, stderr) => {
                    if (!err) {
                        console.log(`👋 Bot ${bot.name} foi desligado e removido.`);
                    } else {
                        console.log(`👎 Falha ao remover os contêineres do bot ${bot.name}`);
                    }
                });
            }
        });
    });
} else {
    recreate();
}
