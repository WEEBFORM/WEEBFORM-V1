import EventEmitter from 'events';
// NEW EVENT EMITTER INSTANCE
const eventEmitter = new EventEmitter();

/**
 * Publishes an event to the event bus.
 * This is a simplified in-memory event bus. In a microservices architecture,
 * this would likely publish to a message queue like RabbitMQ, Kafka, or a cloud-native solution.
 *
 * @param {string} eventName - The name of the event (e.g., "user.joined.group", "message.created").
 * @param {object} data - The payload associated with the event.
 */
export const publishEvent = (eventName, data) => {
  console.log(`[EventBus] Publishing event: ${eventName}`, data);
  eventEmitter.emit(eventName, data);

  // Placeholder for sending to a real message queue or analytics service
  // For example:
  // if (process.env.NODE_ENV === 'production') {
  //   sendToAnalyticsService(eventName, data);
  //   sendToMessageQueue(eventName, data);
  // }
};

/**
 * Subscribes to an event on the event bus.
 *
 * @param {string} eventName - The name of the event to subscribe to.
 * @param {function} listener - The callback function to execute when the event is emitted.
 */
export const subscribeToEvent = (eventName, listener) => {
  console.log(`[EventBus] Subscribing to event: ${eventName}`);
  eventEmitter.on(eventName, listener);
};

/**
 * Unsubscribes from an event.
 *
 * @param {string} eventName - The name of the event.
 * @param {function} listener - The listener function to remove.
 */
export const unsubscribeFromEvent = (eventName, listener) => {
  console.log(`[EventBus] Unsubscribing from event: ${eventName}`);
  eventEmitter.removeListener(eventName, listener);
};

// Example of subscribing to an event (could be in another service or module)
/*
subscribeToEvent('message.created', (data) => {
  console.log('[AnalyticsService] Received message.created event:', data);
  // Perform analytics processing
});
*/

export default eventEmitter;