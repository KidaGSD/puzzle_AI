/**
 * Local ADK Types - Minimal type definitions for ADK integration
 *
 * These types mirror the ADK TypeScript SDK interfaces without requiring
 * the package to be built. This allows development to proceed while
 * the full ADK integration is being set up.
 */

// ========== Session Types ==========

export interface SessionState {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  getAll(): Record<string, any>;
}

export interface Session {
  id: string;
  appName: string;
  userId: string;
  state: SessionState;
  events: Event[];
  addEvent(event: Event): void;
}

export interface SessionOptions {
  id?: string;
  appName?: string;
  userId?: string;
  state?: Record<string, any>;
  events?: Event[];
}

// ========== Event Types ==========

export interface Event {
  invocationId: string;
  author: string;
  branch?: string;
  actions: EventActions;
  content?: Content;
  timestamp: number;
  isFinalResponse(): boolean;
}

export interface EventActions {
  stateDelta: Record<string, any>;
  [key: string]: any;
}

export interface Content {
  parts: Part[];
  role?: string;
}

export interface Part {
  text?: string;
  [key: string]: any;
}

// ========== Tool Types ==========

export interface ToolContext {
  invocationContext: {
    session: Session;
    incrementLlmCallCount(): void;
    [key: string]: any;
  };
}

export interface FunctionDeclaration {
  name: string;
  description?: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface BaseTool {
  name: string;
  description: string;
  execute(params: Record<string, any>, context: ToolContext): Promise<any>;
}

export type ToolFunction = (
  params: Record<string, any>,
  context: ToolContext
) => Promise<any> | any;

export interface FunctionToolOptions {
  name: string;
  description: string;
  fn: ToolFunction;
  functionDeclaration?: FunctionDeclaration;
}

// ========== Agent Types ==========

export interface AgentOptions {
  name: string;
  description?: string;
}

export interface LlmAgentOptions extends AgentOptions {
  model?: string;
  instruction?: string;
  tools?: BaseTool[];
  outputSchema?: any;
  disallowTransferToParent?: boolean;
  disallowTransferToPeers?: boolean;
  beforeModelCallback?: BeforeModelCallback;
  afterModelCallback?: AfterModelCallback;
  generateContentConfig?: GenerateContentConfig;
}

export interface LlmRequest {
  contents: Content[];
  config?: any;
}

export interface LlmResponse {
  content?: Content;
  finishReason?: string;
}

export type BeforeModelCallback = (
  context: CallbackContext,
  request: LlmRequest
) => LlmResponse | undefined | Promise<LlmResponse | undefined>;

export type AfterModelCallback = (
  context: CallbackContext,
  response: LlmResponse
) => LlmResponse | undefined | Promise<LlmResponse | undefined>;

export interface CallbackContext {
  state: SessionState;
  invocationContext: {
    session: Session;
    [key: string]: any;
  };
}

export interface GenerateContentConfig {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  [key: string]: any;
}

// ========== Simple Implementations ==========

/**
 * Simple in-memory session state implementation
 */
export class SimpleSessionState implements SessionState {
  private data: Record<string, any> = {};

  constructor(initial?: Record<string, any>) {
    if (initial) {
      this.data = { ...initial };
    }
  }

  get<T>(key: string, defaultValue?: T): T {
    return key in this.data ? this.data[key] : defaultValue as T;
  }

  set(key: string, value: any): void {
    this.data[key] = value;
  }

  getAll(): Record<string, any> {
    return { ...this.data };
  }
}

/**
 * Simple session implementation
 */
export class SimpleSession implements Session {
  id: string;
  appName: string;
  userId: string;
  state: SessionState;
  events: Event[] = [];

  constructor(options: SessionOptions = {}) {
    this.id = options.id || generateUuid();
    this.appName = options.appName || 'app';
    this.userId = options.userId || 'user';
    this.state = new SimpleSessionState(options.state);
    if (options.events) {
      this.events = [...options.events];
    }
  }

  addEvent(event: Event): void {
    this.events.push(event);
  }
}

/**
 * Simple FunctionTool implementation
 */
export class SimpleFunctionTool implements BaseTool {
  name: string;
  description: string;
  private fn: ToolFunction;
  private functionDeclaration?: FunctionDeclaration;

  constructor(options: FunctionToolOptions) {
    this.name = options.name;
    this.description = options.description;
    this.fn = options.fn;
    this.functionDeclaration = options.functionDeclaration;
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<any> {
    return await this.fn(params, context);
  }

  getDeclaration(): FunctionDeclaration | null {
    return this.functionDeclaration || null;
  }
}

// ========== LlmAgent Implementation ==========

/**
 * LlmAgent - ADK agent that executes LLM calls with tools
 */
export class LlmAgent {
  name: string;
  model: string;
  description: string;
  instruction: string;
  tools: BaseTool[];
  outputSchema?: any;
  beforeModelCallback?: BeforeModelCallback;
  afterModelCallback?: AfterModelCallback;
  generateContentConfig: GenerateContentConfig;

  constructor(options: LlmAgentOptions) {
    this.name = options.name;
    this.model = options.model || 'gemini-2.0-flash';
    this.description = options.description || '';
    this.instruction = options.instruction || '';
    this.tools = options.tools || [];
    this.outputSchema = options.outputSchema;
    this.beforeModelCallback = options.beforeModelCallback;
    this.afterModelCallback = options.afterModelCallback;
    this.generateContentConfig = options.generateContentConfig || {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 2048
    };
  }

  /**
   * Build the full prompt with instruction and context
   */
  buildPrompt(userContent: string, context: Record<string, any>): string {
    let instruction = this.instruction;

    // Replace placeholders in instruction
    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{${key}}`;
      if (typeof value === 'string') {
        instruction = instruction.replace(new RegExp(placeholder, 'g'), value);
      }
    }

    return `${instruction}\n\n---\n\n${userContent}`;
  }

  /**
   * Get tool declarations for function calling
   */
  getToolDeclarations(): FunctionDeclaration[] {
    return this.tools
      .filter(t => t instanceof SimpleFunctionTool)
      .map(t => (t as SimpleFunctionTool).getDeclaration())
      .filter((d): d is FunctionDeclaration => d !== null);
  }
}

// ========== Runner Implementation ==========

export interface RunnerOptions {
  agent: LlmAgent;
  session: Session;
}

export interface RunResult {
  success: boolean;
  output?: any;
  events: Event[];
  error?: string;
}

/**
 * Runner - Executes an LlmAgent with a session
 *
 * This is the core ADK execution pattern:
 * 1. Build prompt from agent instruction + user content
 * 2. Call beforeModelCallback if defined
 * 3. Execute LLM call (via client)
 * 4. Parse structured output if outputSchema defined
 * 5. Execute tool calls if returned
 * 6. Call afterModelCallback
 * 7. Return results
 */
export class Runner {
  agent: LlmAgent;
  session: Session;
  private llmCallCount: number = 0;

  constructor(options: RunnerOptions) {
    this.agent = options.agent;
    this.session = options.session;
  }

  /**
   * Execute the agent with user content
   * Returns structured output based on agent's outputSchema
   */
  async run(
    userContent: string,
    client: { generate: (prompt: string, temperature?: number) => Promise<string> },
    context: Record<string, any> = {}
  ): Promise<RunResult> {
    const events: Event[] = [];
    const invocationId = generateUuid();

    try {
      // Build callback context
      const callbackContext: CallbackContext = {
        state: this.session.state,
        invocationContext: {
          session: this.session,
          incrementLlmCallCount: () => this.llmCallCount++
        }
      };

      // Build tool context
      const toolContext: ToolContext = {
        invocationContext: {
          session: this.session,
          incrementLlmCallCount: () => this.llmCallCount++
        }
      };

      // Store input in session for tools/callbacks
      this.session.state.set('currentInput', userContent);
      this.session.state.set('currentContext', context);

      // Build the LLM request
      const prompt = this.agent.buildPrompt(userContent, context);
      const request: LlmRequest = {
        contents: [{ parts: [{ text: prompt }], role: 'user' }],
        config: this.agent.generateContentConfig
      };

      // Call beforeModelCallback
      if (this.agent.beforeModelCallback) {
        const earlyResponse = await this.agent.beforeModelCallback(callbackContext, request);
        if (earlyResponse) {
          // Callback returned early response, skip LLM call
          return {
            success: true,
            output: earlyResponse.content,
            events
          };
        }
      }

      // Add output schema instruction if defined
      let fullPrompt = prompt;
      if (this.agent.outputSchema) {
        fullPrompt += `\n\nReturn your response as valid JSON matching this schema:\n${JSON.stringify(this.agent.outputSchema, null, 2)}`;
      }

      // Execute LLM call
      this.llmCallCount++;
      const rawResponse = await client.generate(
        fullPrompt,
        this.agent.generateContentConfig.temperature
      );

      // Create response object
      const response: LlmResponse = {
        content: { parts: [{ text: rawResponse }], role: 'assistant' },
        finishReason: 'STOP'
      };

      // Parse structured output
      let output: any = rawResponse;
      if (this.agent.outputSchema) {
        try {
          // Clean markdown code blocks if present
          let cleaned = rawResponse.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.slice(7);
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.slice(3);
          }
          if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
          }
          output = JSON.parse(cleaned.trim());
        } catch (parseError) {
          console.warn(`[Runner:${this.agent.name}] JSON parse failed, using raw output`);
        }
      }

      // Store output in session
      this.session.state.set('lastOutput', output);

      // Check for tool calls in output
      if (output && output.tool_calls) {
        for (const toolCall of output.tool_calls) {
          const tool = this.agent.tools.find(t => t.name === toolCall.name);
          if (tool) {
            const toolResult = await tool.execute(toolCall.parameters || {}, toolContext);
            this.session.state.set(`tool_result_${toolCall.name}`, toolResult);
          }
        }
      }

      // If output contains pieces, automatically call record_pieces tool
      if (output && output.pieces && Array.isArray(output.pieces)) {
        const recordTool = this.agent.tools.find(t => t.name === 'record_pieces');
        if (recordTool) {
          await recordTool.execute({ pieces: output.pieces }, toolContext);
        }
      }

      // Call afterModelCallback
      if (this.agent.afterModelCallback) {
        await this.agent.afterModelCallback(callbackContext, response);
      }

      // Create event
      const event: Event = {
        invocationId,
        author: this.agent.name,
        actions: { stateDelta: {} },
        content: response.content,
        timestamp: Date.now(),
        isFinalResponse: () => true
      };
      events.push(event);
      this.session.addEvent(event);

      return {
        success: true,
        output,
        events
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        events
      };
    }
  }

  /**
   * Async generator for streaming responses (future use)
   */
  async *runAsync(
    userContent: string,
    client: { generate: (prompt: string, temperature?: number) => Promise<string> },
    context: Record<string, any> = {}
  ): AsyncGenerator<Event, RunResult, unknown> {
    const result = await this.run(userContent, client, context);
    for (const event of result.events) {
      yield event;
    }
    return result;
  }
}

// ========== Utility Functions ==========

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
