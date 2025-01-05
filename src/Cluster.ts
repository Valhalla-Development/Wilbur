import { ClusterManager } from 'discord-hybrid-sharding';
import 'dotenv/config';
import { dirname } from '@discordx/importer';

const config = process.env;

const dir = dirname(import.meta.url);
const manager = new ClusterManager(`${dir}/Main.ts`, {
    totalShards: 1,
    shardsPerClusters: 2,
    totalClusters: 1,
    mode: 'process',
    token: config.TOKEN,
});

manager.on('clusterCreate', (cluster) => console.log(`Cluster ${cluster.id} is off to the races, mate! Let's gooo!`));
await manager.spawn({ timeout: -1 });
