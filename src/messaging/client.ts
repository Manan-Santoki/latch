/**
 * Latch — messaging client.
 *
 * Typed wrapper over chrome.runtime.sendMessage used by the popup, options page,
 * and overlay iframe to talk to the background worker. The response type is
 * inferred from the message type via ResponseMap.
 */

import type { ExtensionMessage, ResponseFor } from './protocol';

export async function sendMessage<M extends ExtensionMessage>(
  message: M,
): Promise<ResponseFor<M['type']>> {
  return (await chrome.runtime.sendMessage(message)) as ResponseFor<M['type']>;
}
