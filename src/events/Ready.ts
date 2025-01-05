import type { Client } from 'discordx';
import { Discord, Once } from 'discordx';
import si from 'systeminformation';
import '@colors/colors';
import { type ActivityOptions, ActivityType, version } from 'discord.js';

/**
 * Discord.js Ready event handler.
 */
@Discord()
export class Ready {
    /**
     * Executes when the ready event is emitted.
     * @param client - The Discord client.
     * @returns void
     */
    @Once({ event: 'ready' })
    async onReady([client]: [Client]) {
        // Init slash commands
        await client.initApplicationCommands();

        async function logStartup(): Promise<void> {
            const memory = await si.mem();
            const cpu = await si.cpu();
            const totalMemory = Math.floor(memory.total / 1024 / 1024);
            const realMemUsed = Math.floor((memory.used - memory.buffcache) / 1024 / 1024);

            const divider = '*~'.repeat(20);
            const sections = [
                {
                    content: [
                        divider.rainbow.bold,
                        `${client.user?.username} is online and ready!`.cyan.bold,
                        divider.rainbow.bold,
                    ],
                },
                {
                    title: `${client.user?.username} Stats`,
                    content: [
                        `${'>>'.red} Users: `.white + client.guilds.cache.reduce((acc: number, guild) => acc + guild.memberCount, 0).toLocaleString('en').red,
                        `${'>>'.green} Guilds: `.white + client.guilds.cache.size.toLocaleString('en').green,
                        `${'>>'.yellow} Slash Commands: `.white + `${client.application?.commands.cache.size ?? 0}`.yellow,
                        `${'>>'.blue} Events: `.white + client.eventNames().length.toString().blue,
                    ],
                },
                {
                    title: `${client.user?.username} Specs`,
                    content: [
                        `${`${'>>'.magenta} Node: `.white}${process.version.magenta}${' on '.white}${`${process.platform} ${process.arch}`.magenta}`,
                        `${'>>'.cyan} Memory: `.white + `${realMemUsed.toLocaleString('en')}/${totalMemory.toLocaleString('en')} MB`.cyan,
                        `${'>>'.red} CPU: `.white + `${cpu.vendor} ${cpu.brand}`.red,
                        `${'>>'.yellow} Discord.js: `.white + `v${version}`.yellow,
                        `${'>>'.blue} Version: `.white + `v${process.env.npm_package_version}`.blue,
                    ],
                },
                {
                    title: `${client.user?.username} Invite Link`,
                    content: [
                        `${'>>'.blue} `.white + `https://discordapp.com/oauth2/authorize?client_id=${client.user?.id}&scope=bot%20applications.commands&permissions=535327927376`.blue.underline,
                    ],
                },
            ];

            console.log(`\n${'='.repeat(50).bold}`);
            sections.forEach((section) => {
                if (section.title) console.log(`\n>>> ${section.title} <<<`.magenta.bold);
                section.content.forEach((line) => console.log(`${line}`.bold));
            });
            console.log(`${'='.repeat(50).bold}`);
        }

        await logStartup();

        // Set activity
        const messages: ActivityOptions[] = [
            {
                type: ActivityType.Playing,
                name: `with ${client.guilds.cache.reduce((a, b) => a + b.memberCount, 0).toLocaleString('en')} sharks`,
            },
            {
                type: ActivityType.Watching,
                name: `${client.guilds.cache.size.toLocaleString('en')} swarms of sharks`,
            },
            {
                type: ActivityType.Playing,
                name: 'shark tag 🏊',
            },
            {
                type: ActivityType.Competing,
                name: 'a shark race',
            },
            {
                type: ActivityType.Listening,
                name: 'shark music',
            },
        ];

        function setRandomStatus() {
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            client.user?.setActivity(randomMessage);
        }

        // Set status immediately when the bot starts
        setRandomStatus();

        // Update status every 30 seconds
        setInterval(setRandomStatus, 30 * 1000);
    }
}
