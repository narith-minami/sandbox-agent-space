import { createOpencode, type Auth as OpencodeAuth } from '@opencode-ai/sdk';

export interface GeneratePlanOptions {
  prompt: string;
  auth?: string; // Base64-encoded JSON auth
}

export interface GeneratePlanResult {
  plan: string;
  sessionId: string;
}

/**
 * Generate an implementation plan using OpenCode SDK's plan agent
 *
 * @param options - Configuration for plan generation
 * @returns Generated plan text and OpenCode session ID
 * @throws Error if SDK initialization fails, session creation fails, or no plan content is returned
 */
export async function generatePlan(options: GeneratePlanOptions): Promise<GeneratePlanResult> {
  const { prompt, auth } = options;

  // 1. Initialize OpenCode SDK with extended timeout and auto port assignment
  // Plan generation can take longer than the default 5s timeout
  // Use port 0 to let the OS automatically assign an available port
  const { client, server } = await createOpencode({
    timeout: 30000, // 30 seconds
    port: 0, // Auto-assign available port (avoids port conflicts)
  });

  try {
    // 2. Parse and set authentication if provided
    if (auth) {
      const authJson: Record<string, OpencodeAuth> = JSON.parse(
        Buffer.from(auth, 'base64').toString('utf-8')
      );

      for (const [providerId, providerAuth] of Object.entries(authJson)) {
        await client.auth.set({
          path: { id: providerId },
          body: providerAuth,
        });
      }
    }

    // 3. Create OpenCode session
    const sessionResponse = await client.session.create({});
    const session = sessionResponse.data;

    if (!session?.id) {
      throw new Error('Failed to create OpenCode session');
    }

    const sessionId = session.id;

    // 4. Execute plan agent with prompt
    await client.session.prompt({
      path: { id: sessionId },
      body: {
        agent: 'plan',
        parts: [
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    });

    // 5. Get session messages to extract plan
    const messagesResponse = await client.session.messages({
      path: { id: sessionId },
    });

    // Debug: Log the messages response for troubleshooting
    console.log('[OpenCode] Messages response:', JSON.stringify(messagesResponse.data, null, 2));

    // Extract plan from last assistant message
    const planContent = extractPlanFromMessages(messagesResponse.data);

    return {
      plan: planContent,
      sessionId: sessionId,
    };
  } finally {
    // 6. Always cleanup - close server
    server.close();
  }
}

/**
 * Message part from OpenCode session
 */
interface MessagePart {
  type: string;
  text?: string;
}

/**
 * Message from OpenCode session
 */
interface OpencodeMessage {
  info?: {
    role?: string;
  };
  parts?: MessagePart[];
}

/**
 * Extract plan content from OpenCode session messages
 *
 * @param messages - Array of messages from OpenCode session
 * @returns Extracted plan text
 * @throws Error if messages are invalid or no plan content is found
 */
function extractPlanFromMessages(messages: unknown): string {
  if (!messages || !Array.isArray(messages)) {
    throw new Error('Invalid messages response from OpenCode');
  }

  // Get last message with text parts from assistant
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as OpencodeMessage;

    // Check if this is an assistant message with parts
    if (message?.info?.role === 'assistant' && Array.isArray(message.parts)) {
      // Extract text from all text parts
      const textParts = message.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .filter((text): text is string => !!text?.trim());

      if (textParts.length > 0) {
        return textParts.join('\n\n');
      }
    }
  }

  throw new Error('No plan content found in OpenCode response');
}
