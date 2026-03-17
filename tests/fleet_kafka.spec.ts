import { test, expect } from '../src/fixtures';
import { KafkaHelper } from '../src/helpers/KafkaHelper';

/**
 * Integration Test Suite: Fleet Safety Kafka Pipeline
 * Purpose: Validate real-time telemetry processing and alerting logic
 */
test.describe('Fleet Safety Kafka Integration — Event Driven Testing', () => {
    let kafkaHelper: KafkaHelper;

    // Initialize and connect to the Kafka broker before running tests
    test.beforeAll(async () => {
        kafkaHelper = new KafkaHelper();
        await kafkaHelper.connect();
    });

    // Clean up Kafka producer connections after suite completion
    test.afterAll(async () => {
        await kafkaHelper.disconnect();
    });

    /**
     * TC-012: Alert Trigger Validation
     * Scenario: A truck exceeds speed limits in a restricted zone (School Zone)
     * Expected: Kafka consumer identifies the violation and stores a record in PostGIS
     */
    test('TC-012: Should trigger a speeding alert when truck exceeds limit in restricted zone', async ({ dbHelper }) => {
        const truckId = 'VOLVO-FH16';
        const highSpeed = 115;
        const schoolZoneLocation = { lat: 51.5117, lon: -0.1246 }; // Coordinates near Covent Garden

        // 1. Action: Publish a telemetry event to the 'truck-telemetry' Kafka topic
        await kafkaHelper.sendTelemetry('truck-telemetry', {
            truckId,
            speed: highSpeed,
            location: schoolZoneLocation,
            timestamp: new Date().toISOString(),
        });

        // 2. Assertion: Poll the database to verify the asynchronous data processing
        // Uses smart polling to account for network latency and consumer processing time
        // 2. Assertion: Poll the database
        await expect.poll(async () => {
            const alerts = await dbHelper.getAlertsByTruckId(truckId);
            return alerts.length;
        }, {
            message: 'Waiting for Kafka consumer to process and sync speeding event with PostGIS',
            timeout: 20000, // 20 seconds is plenty if the consumer is working
        }).toBeGreaterThan(0);

        // 3. Integrity Check: Validate that stored alert details match the telemetry event
        const alerts = await dbHelper.getAlertsByTruckId(truckId);
        const latestAlert = alerts[0];

        expect(latestAlert.type).toBe('SPEEDING_VIOLATION');
        expect(Number(latestAlert.speed)).toBe(highSpeed);
    });
});