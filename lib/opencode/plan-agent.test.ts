import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePlan } from './plan-agent';

// Mock @opencode-ai/sdk
const mockClose = vi.fn();
const mockAuthSet = vi.fn();
const mockSessionCreate = vi.fn();
const mockSessionPrompt = vi.fn();
const mockSessionMessages = vi.fn();

vi.mock('@opencode-ai/sdk', () => ({
  createOpencode: vi.fn(() =>
    Promise.resolve({
      client: {
        auth: {
          set: mockAuthSet,
        },
        session: {
          create: mockSessionCreate,
          prompt: mockSessionPrompt,
          messages: mockSessionMessages,
        },
      },
      server: {
        close: mockClose,
      },
    })
  ),
}));

describe('generatePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a plan successfully', async () => {
    // Arrange
    const sessionId = 'test-session-123';
    const planText = '# Implementation Plan\n\n1. Step one\n2. Step two';

    mockSessionCreate.mockResolvedValue({
      data: { id: sessionId },
    });

    mockSessionMessages.mockResolvedValue({
      data: [
        {
          info: { role: 'user' },
          parts: [{ type: 'text', text: 'Test prompt' }],
        },
        {
          info: { role: 'assistant' },
          parts: [{ type: 'text', text: planText }],
        },
      ],
    });

    // Act
    const result = await generatePlan({
      prompt: 'Implement user authentication',
    });

    // Assert
    expect(result).toEqual({
      plan: planText,
      sessionId: sessionId,
    });

    expect(mockSessionCreate).toHaveBeenCalledWith({});
    expect(mockSessionPrompt).toHaveBeenCalledWith({
      path: { id: sessionId },
      body: {
        agent: 'plan',
        parts: [
          {
            type: 'text',
            text: 'Implement user authentication',
          },
        ],
      },
    });
    expect(mockSessionMessages).toHaveBeenCalledWith({
      path: { id: sessionId },
    });
    expect(mockClose).toHaveBeenCalled();
  });

  it('should set authentication when auth is provided', async () => {
    // Arrange
    const auth = Buffer.from(
      JSON.stringify({
        anthropic: { type: 'api', key: 'test-key' },
        openai: { type: 'oauth', access: 'test-token' },
      })
    ).toString('base64');

    mockSessionCreate.mockResolvedValue({
      data: { id: 'session-123' },
    });

    mockSessionMessages.mockResolvedValue({
      data: [
        {
          info: { role: 'assistant' },
          parts: [{ type: 'text', text: 'Plan content' }],
        },
      ],
    });

    // Act
    await generatePlan({
      prompt: 'Test prompt',
      auth,
    });

    // Assert
    expect(mockAuthSet).toHaveBeenCalledTimes(2);
    expect(mockAuthSet).toHaveBeenCalledWith({
      path: { id: 'anthropic' },
      body: { type: 'api', key: 'test-key' },
    });
    expect(mockAuthSet).toHaveBeenCalledWith({
      path: { id: 'openai' },
      body: { type: 'oauth', access: 'test-token' },
    });
  });

  it('should extract plan from multiple text parts', async () => {
    // Arrange
    mockSessionCreate.mockResolvedValue({
      data: { id: 'session-123' },
    });

    mockSessionMessages.mockResolvedValue({
      data: [
        {
          info: { role: 'assistant' },
          parts: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' },
            { type: 'text', text: 'Part 3' },
          ],
        },
      ],
    });

    // Act
    const result = await generatePlan({
      prompt: 'Test prompt',
    });

    // Assert
    expect(result.plan).toBe('Part 1\n\nPart 2\n\nPart 3');
  });

  it('should filter out empty text parts', async () => {
    // Arrange
    mockSessionCreate.mockResolvedValue({
      data: { id: 'session-123' },
    });

    mockSessionMessages.mockResolvedValue({
      data: [
        {
          info: { role: 'assistant' },
          parts: [
            { type: 'text', text: 'Valid text' },
            { type: 'text', text: '' },
            { type: 'text', text: '   ' },
            { type: 'text', text: 'Another valid text' },
          ],
        },
      ],
    });

    // Act
    const result = await generatePlan({
      prompt: 'Test prompt',
    });

    // Assert
    expect(result.plan).toBe('Valid text\n\nAnother valid text');
  });

  it('should throw error if session creation fails', async () => {
    // Arrange
    mockSessionCreate.mockResolvedValue({
      data: null,
    });

    // Act & Assert
    await expect(
      generatePlan({
        prompt: 'Test prompt',
      })
    ).rejects.toThrow('Failed to create OpenCode session');

    expect(mockClose).toHaveBeenCalled();
  });

  it('should throw error if no plan content is found', async () => {
    // Arrange
    mockSessionCreate.mockResolvedValue({
      data: { id: 'session-123' },
    });

    mockSessionMessages.mockResolvedValue({
      data: [
        {
          info: { role: 'user' },
          parts: [{ type: 'text', text: 'User message' }],
        },
      ],
    });

    // Act & Assert
    await expect(
      generatePlan({
        prompt: 'Test prompt',
      })
    ).rejects.toThrow('No plan content found in OpenCode response');

    expect(mockClose).toHaveBeenCalled();
  });

  it('should throw error if messages response is invalid', async () => {
    // Arrange
    mockSessionCreate.mockResolvedValue({
      data: { id: 'session-123' },
    });

    mockSessionMessages.mockResolvedValue({
      data: null,
    });

    // Act & Assert
    await expect(
      generatePlan({
        prompt: 'Test prompt',
      })
    ).rejects.toThrow('Invalid messages response from OpenCode');

    expect(mockClose).toHaveBeenCalled();
  });

  it('should close server even if an error occurs', async () => {
    // Arrange
    mockSessionCreate.mockRejectedValue(new Error('SDK error'));

    // Act & Assert
    await expect(
      generatePlan({
        prompt: 'Test prompt',
      })
    ).rejects.toThrow('SDK error');

    expect(mockClose).toHaveBeenCalled();
  });

  it('should skip non-text parts when extracting plan', async () => {
    // Arrange
    mockSessionCreate.mockResolvedValue({
      data: { id: 'session-123' },
    });

    mockSessionMessages.mockResolvedValue({
      data: [
        {
          info: { role: 'assistant' },
          parts: [
            { type: 'file', path: '/test.txt' },
            { type: 'text', text: 'Text content' },
            { type: 'image', url: 'http://example.com/img.png' },
          ],
        },
      ],
    });

    // Act
    const result = await generatePlan({
      prompt: 'Test prompt',
    });

    // Assert
    expect(result.plan).toBe('Text content');
  });

  it('should find assistant message even if not the last message', async () => {
    // Arrange
    mockSessionCreate.mockResolvedValue({
      data: { id: 'session-123' },
    });

    mockSessionMessages.mockResolvedValue({
      data: [
        {
          info: { role: 'assistant' },
          parts: [{ type: 'text', text: 'Plan content' }],
        },
        {
          info: { role: 'system' },
          parts: [{ type: 'text', text: 'System message' }],
        },
      ],
    });

    // Act
    const result = await generatePlan({
      prompt: 'Test prompt',
    });

    // Assert
    // Should get the last assistant message (searches from end)
    expect(result.plan).toBe('Plan content');
  });
});
