export interface ProcessedEventRepository {
  /**
   * Registra el `id` del envelope y devuelve `true` solo la primera vez. Una segunda entrega del
   * mismo mensaje devuelve `false`, y el consumidor debe hacer `ack` sin repetir el efecto.
   */
  markAsProcessed(eventId: string): Promise<boolean>;
}
