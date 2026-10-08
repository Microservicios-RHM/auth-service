import type { Logger } from 'pino';
import type { ProcessedEventRepository } from '../../../domain/repositories/processed-event.repository.ts';
import type { RabbitMqConnection } from './rabbitmq.connection.ts';
import { parseEnvelope, type EventEnvelope } from './event-envelope.ts';

export type EventHandler = (envelope: EventEnvelope) => Promise<void>;

const EXCHANGE_TYPE = 'topic';
const PREFETCH = 10;

export class RabbitmqEventConsumer {
  private readonly connection: RabbitMqConnection;
  private readonly exchange: string;
  private readonly queue: string;
  private readonly processedEvents: ProcessedEventRepository;
  private readonly logger: Logger;
  private readonly handlers = new Map<string, EventHandler>();

  constructor(
    connection: RabbitMqConnection,
    exchange: string,
    queue: string,
    processedEvents: ProcessedEventRepository,
    logger: Logger,
  ) {
    this.connection = connection;
    this.exchange = exchange;
    this.queue = queue;
    this.processedEvents = processedEvents;
    this.logger = logger;
  }

  on(eventType: string, handler: EventHandler): void {
    this.handlers.set(eventType, handler);
  }

  async start(): Promise<void> {
    const channel = await this.connection.ensureChannel();
    if (!channel) {
      this.logger.error('RabbitMQ unavailable; account lifecycle events will not be consumed');
      return;
    }

    await channel.prefetch(PREFETCH);
    await channel.assertExchange(this.exchange, EXCHANGE_TYPE, { durable: true });
    await channel.assertQueue(this.queue, { durable: true });
    for (const eventType of this.handlers.keys()) {
      await channel.bindQueue(this.queue, this.exchange, eventType);
    }

    await channel.consume(this.queue, (message) => {
      if (!message) return;
      void this.dispatch(message.content.toString(), message.fields.routingKey)
        .then(() => channel.ack(message))
        .catch((error: unknown) => {
          this.logger.error(
            { err: error, routingKey: message.fields.routingKey },
            'Event discarded',
          );
          channel.nack(message, false, false);
        });
    });

    this.logger.info(
      { exchange: this.exchange, queue: this.queue, bindings: [...this.handlers.keys()] },
      'RabbitMQ connection ready',
    );
  }

  // Separado de start() para poder probar el parseo, la deduplicación y el despacho sin una
  // conexión real, igual que el consumer de ms-vacation.
  async dispatch(body: string, routingKey: string): Promise<void> {
    const handler = this.handlers.get(routingKey);
    if (!handler) return;

    const envelope = parseEnvelope(body);

    if (!(await this.processedEvents.markAsProcessed(envelope.id))) {
      this.logger.info(
        { eventId: envelope.id, eventType: envelope.type },
        'Duplicate event ignored',
      );
      return;
    }

    await handler(envelope);
  }
}
