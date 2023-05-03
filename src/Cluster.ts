import { ClusterManager } from 'discord-hybrid-sharding';
import 'dotenv/config';
import { dirname } from '@discordx/importer';

const config = process.env;

const dir = dirname(import.meta.url);
const manager = new ClusterManager(`${dir}/Main.js`, {
    totalShards: 1,
    shardsPerClusters: 2,
    totalClusters: 1,
    mode: 'process',
    token: config.TOKEN,
});

manager.on('clusterCreate', (cluster) => console.log(`Launched Cluster ${cluster.id}`));
await manager.spawn({ timeout: -1 });
