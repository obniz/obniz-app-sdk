import IORedis from 'ioredis';

const redis = new IORedis();
const slaveCount = 100;
const instancesCount = 10000;

const countToDummyId = (count: number) => {
  const str = count.toString().padStart(8, '0');
  return `${str.slice(0, 4)}-${str.slice(4, 8)}`;
};

const main = async () => {
  // Add Slave Heartbeat
  for (let i = 0; i < slaveCount; i++) {
    await redis.set(`slave:dummy-${i}:heartbeat`, Date.now());
  }

  // Add Instances
  for (let i = 0; i < instancesCount; i++) {
    const dummyId = countToDummyId(i);
    const instanceId = Math.floor(Math.random() * 99);
    const dummyInstall = {
      instanceName: `dummy-${instanceId}`,
      updateMillisecond: Date.now(),
      install: {
        id: dummyId,
      },
    };
    await redis.hsetnx(
      `workers:dummy-${instanceId}`,
      dummyId,
      JSON.stringify(dummyInstall)
    );
  }
  console.log('Done.');

  redis.disconnect();
};

main();
