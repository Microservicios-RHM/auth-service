/**
 * Propagación del contexto de traza a través de RabbitMQ (Reto 8).
 *
 * Por HTTP la propagación la hace la instrumentación automática, pero un mensaje AMQP no es una
 * petición HTTP: si nadie copia el `traceparent` a las cabeceras del mensaje, cada consumidor
 * (auth, notificaciones, perfiles, vacaciones) empieza una traza nueva y el onboarding aparece en
 * Zipkin como trazas sueltas. Aquí se crea un span PRODUCER por cada publicación y su contexto se
 * inyecta (W3C Trace Context) en las cabeceras del mensaje; los consumidores lo extraen.
 */
import { ROOT_CONTEXT, SpanKind, SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';

const tracer = trace.getTracer('rhm-messaging');

export type MessageHeaders = Record<string, string>;

/**
 * Lado consumidor: extrae el `traceparent` de las cabeceras del mensaje y procesa el evento dentro
 * de un span CONSUMER hijo del span PRODUCER que lo publicó. Todo lo que ocurra dentro (consultas a
 * PostgreSQL, logs, nuevos eventos publicados) queda en la misma traza.
 */
export async function withConsumeSpan<T>(
  headers: Record<string, unknown> | undefined,
  queue: string,
  routingKey: string,
  process: () => Promise<T>,
): Promise<T> {
  const carrier: MessageHeaders = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value === 'string') carrier[key] = value;
    else if (Buffer.isBuffer(value)) carrier[key] = value.toString('utf8');
  }
  const parentContext = propagation.extract(ROOT_CONTEXT, carrier);

  return tracer.startActiveSpan(
    `${routingKey} process`,
    {
      kind: SpanKind.CONSUMER,
      attributes: {
        'messaging.system': 'rabbitmq',
        'messaging.operation.type': 'process',
        'messaging.destination.name': queue,
        'messaging.rabbitmq.destination.routing_key': routingKey,
      },
    },
    parentContext,
    async (span) => {
      try {
        return await process();
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export async function withPublishSpan<T>(
  exchange: string,
  routingKey: string,
  publish: (headers: MessageHeaders) => Promise<T> | T,
): Promise<T> {
  return tracer.startActiveSpan(
    `${routingKey} publish`,
    {
      kind: SpanKind.PRODUCER,
      attributes: {
        'messaging.system': 'rabbitmq',
        'messaging.operation.type': 'publish',
        'messaging.destination.name': exchange,
        'messaging.rabbitmq.destination.routing_key': routingKey,
      },
    },
    async (span) => {
      try {
        const headers: MessageHeaders = {};
        propagation.inject(context.active(), headers);
        return await publish(headers);
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
