#!/usr/bin/env tsx
/**
 * Standalone test script for OpenCode plan agent
 *
 * This script helps debug the plan generation by directly calling the OpenCode SDK
 * and logging the full response structure.
 *
 * Usage:
 *   COMMON_OPENCODE_AUTH_JSON_B64="..." tsx scripts/test-opencode-plan.ts
 */

import { createOpencode, type Auth as OpencodeAuth } from '@opencode-ai/sdk';

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

async function testPlanGeneration() {
  console.log('=== OpenCode Plan Agent Test ===\n');

  // 1. Check authentication
  const auth = process.env.COMMON_OPENCODE_AUTH_JSON_B64;
  if (!auth) {
    console.error('❌ COMMON_OPENCODE_AUTH_JSON_B64 environment variable is not set');
    console.log('\nPlease set it with:');
    console.log('export COMMON_OPENCODE_AUTH_JSON_B64="<your-base64-encoded-auth-json>"');
    process.exit(1);
  }

  console.log('✅ Authentication found');

  // 2. Initialize OpenCode SDK
  console.log('\n📡 Initializing OpenCode SDK...');
  const { client, server } = await createOpencode({
    timeout: 30000,
    port: 0,
  });

  console.log('✅ OpenCode server started');

  try {
    // 3. Set authentication
    console.log('\n🔐 Setting authentication...');
    const authJson: Record<string, OpencodeAuth> = JSON.parse(
      Buffer.from(auth, 'base64').toString('utf-8')
    );

    for (const [providerId, providerAuth] of Object.entries(authJson)) {
      await client.auth.set({
        path: { id: providerId },
        body: providerAuth,
      });
      console.log(`✅ Set auth for provider: ${providerId}`);
    }

    // 4. Create session
    console.log('\n📝 Creating OpenCode session...');
    const sessionResponse = await client.session.create({});
    const session = sessionResponse.data;

    if (!session?.id) {
      throw new Error('Failed to create session - no session ID returned');
    }

    console.log(`✅ Session created: ${session.id}`);

    // 5. Send prompt with plan agent
    const testPrompt =
      'Create a simple implementation plan for adding user authentication with JWT tokens';
    console.log('\n🤖 Sending prompt to plan agent...');
    console.log(`Prompt: "${testPrompt}"`);

    await client.session.prompt({
      path: { id: session.id },
      body: {
        agent: 'plan',
        parts: [
          {
            type: 'text',
            text: testPrompt,
          },
        ],
      },
    });

    console.log('✅ Prompt sent, waiting for response...');

    // 6. Get messages
    console.log('\n📬 Fetching session messages...');
    const messagesResponse = await client.session.messages({
      path: { id: session.id },
    });

    console.log('\n=== RAW MESSAGES RESPONSE ===');
    console.log(JSON.stringify(messagesResponse.data, null, 2));
    console.log('=== END RAW MESSAGES ===\n');

    // 7. Analyze message structure
    const messages = messagesResponse.data;

    if (!messages || !Array.isArray(messages)) {
      console.error('❌ Messages is not an array:', typeof messages);
      process.exit(1);
    }

    console.log(`📊 Total messages: ${messages.length}\n`);

    messages.forEach((msg: OpencodeMessage, index: number) => {
      console.log(`--- Message ${index + 1} ---`);
      console.log(`Role: ${msg?.info?.role || 'unknown'}`);
      console.log(`Parts count: ${Array.isArray(msg?.parts) ? msg.parts.length : 0}`);

      if (Array.isArray(msg?.parts)) {
        msg.parts.forEach((part: MessagePart, partIndex: number) => {
          console.log(`  Part ${partIndex + 1}:`);
          console.log(`    Type: ${part?.type || 'unknown'}`);
          if (part?.text) {
            const preview = part.text.substring(0, 100).replace(/\n/g, ' ');
            console.log(`    Text preview: "${preview}..."`);
            console.log(`    Text length: ${part.text.length} characters`);
          } else {
            console.log(`    Text: null or undefined`);
          }
        });
      }
      console.log();
    });

    // 8. Try to extract plan
    console.log('🔍 Attempting plan extraction...');

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i] as OpencodeMessage;

      if (message?.info?.role === 'assistant' && Array.isArray(message.parts)) {
        const textParts = message.parts
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .filter((text): text is string => !!text?.trim());

        if (textParts.length > 0) {
          console.log('✅ Plan found!');
          console.log('\n=== EXTRACTED PLAN ===');
          console.log(textParts.join('\n\n'));
          console.log('=== END PLAN ===\n');
          process.exit(0);
        }
      }
    }

    console.error('❌ No plan content found in assistant messages');
    console.log('\nPossible issues:');
    console.log('1. Plan agent may not be configured in ~/.config/opencode/config.json');
    console.log('2. Authentication provider may not support the plan agent');
    console.log('3. The plan agent may not have responded yet (try increasing timeout)');

    process.exit(1);
  } catch (error) {
    console.error('\n❌ Error during plan generation:');
    console.error(error);
    process.exit(1);
  } finally {
    console.log('\n🧹 Cleaning up...');
    server.close();
    console.log('✅ Server closed');
  }
}

// Run the test
testPlanGeneration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
