import type { Client } from 'discordx';
import { Discord, Once } from 'discordx';
import si from 'systeminformation';
import '@colors/colors';
import { ActivityType, ActivityOptions, version } from 'discord.js';

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

        // Fetch stats
        const memory = await si.mem();
        const totalMemory = Math.floor(memory.total / 1024 / 1024);
        const cachedMem = memory.buffcache / 1024 / 1024;
        const memoryUsed = memory.used / 1024 / 1024;
        const realMemUsed = Math.floor(memoryUsed - cachedMem);

        // Bot Info
        console.log(
            '\n',
            `——————————[${client.user?.username} Info]——————————`.red.bold,
        );
        console.log(
            'Users:'.white.bold,
            `${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0).toLocaleString('en')}`.yellow.bold,
        );
        console.log(
            'Guilds:'.white.bold,
            `${client.guilds.cache.size.toLocaleString('en')}`.yellow.bold,
        );
        console.log(
            'Slash Commands:'.white.bold,
            `${client.applicationCommands.length}`.yellow.bold,
        );
        console.log(
            'Events:'.white.bold,
            `${client.events.length}`.yellow.bold,
        );
        console.log(
            'Invite:'.white.bold,
            `https://discordapp.com/oauth2/authorize?client_id=${client.user?.id}&scope=bot%20applications.commands&permissions=535327927376`.blue.underline.bold,
        );

        // Bot Specs
        console.log(
            '\n',
            `——————————[${client.user?.username} Specs]——————————`.red.bold,
        );
        console.log(
            'Running Node:'.white.bold,
            `${process.version}`.magenta.bold,
            'on'.white.bold,
            `${process.platform} ${process.arch}`.magenta.bold,
        );
        console.log(
            'Memory:'.white.bold,
            `${realMemUsed.toLocaleString('en')}`.yellow.bold,
            '/'.white.bold,
            `${totalMemory.toLocaleString('en')}`.yellow.bold,
            'MB'.white.bold,
        );
        console.log(
            'Discord.js Version:'.white.bold,
            `${version}`.green.bold,
        );
        console.log(
            `${client.user?.username} Version:`.white.bold,
            `${process.env.npm_package_version}`.green.bold,
            '\n',
        );

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
