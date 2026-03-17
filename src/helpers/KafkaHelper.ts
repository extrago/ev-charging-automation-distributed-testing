import { Kafka, Producer } from 'kafkajs';
import { envConfig } from '../config/envConfig';

export class KafkaHelper {
    private producer: Producer;

    constructor() {
        const kafka = new Kafka({
            clientId: 'fleet-test-producer',
            brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
        });
        this.producer = kafka.producer();
    }

    /**
     * Connects to the Kafka broker
     */
    async connect(): Promise<void> {
        await this.producer.connect();
    }

    /**
     * Disconnects from the Kafka broker
     */
    async disconnect(): Promise<void> {
        await this.producer.disconnect();
    }

    /**
     * Sends a telemetry event to a specific topic
     * @param topic Kafka topic name
     * @param message Object containing truck telemetry (id, speed, location)
     */
    async sendTelemetry(topic: string, message: object): Promise<void> {
        await this.producer.send({
            topic,
            messages: [
                { value: JSON.stringify(message) },
            ],
        });
    }
}