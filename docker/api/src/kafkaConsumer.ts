import { Kafka, EachMessagePayload } from 'kafkajs';
import { pool } from './db';

const kafka = new Kafka({
    clientId: 'fleet-api-consumer',
    brokers: [process.env.KAFKA_BROKER || 'kafka:29092']
});

const consumer = kafka.consumer({ groupId: 'fleet-safety-group' });

export async function startKafkaConsumer(): Promise<void> {
    try {
        await consumer.connect();
        console.log('[Kafka] Consumer connected successfully to broker');

        await consumer.subscribe({ topic: 'truck-telemetry', fromBeginning: false });

        await consumer.run({
            // Added EachMessagePayload type to satisfy TypeScript strict mode
            eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
                if (!message.value) return;

                const payload = message.value.toString();
                const data = JSON.parse(payload);

                console.log(`[Kafka] Received telemetry for truck: ${data.truckId} at speed ${data.speed}`);

                if (data.speed > 100) {
                    console.log(`[Kafka] ALERT: Speeding violation detected! Saving to database...`);

                    const query = `
            INSERT INTO alerts (truck_id, type, speed, location, created_at)
            VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6)
          `;

                    await pool.query(query, [
                        data.truckId,
                        'SPEEDING_VIOLATION',
                        data.speed,
                        data.location.lon,
                        data.location.lat,
                        data.timestamp || new Date().toISOString()
                    ]);
                }
            },
        });
    } catch (error) {
        console.error('[Kafka] Consumer Error:', error);
    }
}