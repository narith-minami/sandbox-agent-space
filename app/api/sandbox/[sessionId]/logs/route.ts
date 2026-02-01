import { NextResponse } from 'next/server';
import { getSession } from '@/lib/db/queries';
import { getSandboxManager } from '@/lib/sandbox/manager';
import { validateUUID } from '@/lib/validators/config';
import type { ApiError } from '@/types/sandbox';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function GET(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { sessionId } = await params;
    
    // Validate session ID
    try {
      validateUUID(sessionId);
    } catch {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid session ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Check if session exists
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json<ApiError>(
        {
          error: 'Session not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Create SSE stream for real-time log streaming
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const sandboxManager = getSandboxManager();
          
          // Send initial connection message
          const initData = `data: ${JSON.stringify({ 
            type: 'connected', 
            sessionId,
            sandboxId: session.sandboxId,
            status: session.status,
          })}\n\n`;
          controller.enqueue(encoder.encode(initData));

          // Stream logs from the sandbox manager
          // This uses the database-backed log streaming which captures
          // stdout/stderr from the Vercel Sandbox SDK
          for await (const log of sandboxManager.streamLogs(sessionId)) {
            const data = `data: ${JSON.stringify({
              type: 'log',
              timestamp: log.timestamp.toISOString(),
              level: log.level,
              message: log.message,
            })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          // Send completion message
          const endData = `data: ${JSON.stringify({ type: 'complete' })}\n\n`;
          controller.enqueue(encoder.encode(endData));
          
          controller.close();
        } catch (error) {
          const errorData = `data: ${JSON.stringify({ 
            type: 'error', 
            message: error instanceof Error ? error.message : 'Unknown error' 
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Failed to stream logs:', error);
    
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to stream logs',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
