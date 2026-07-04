import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AppConfig } from '../../config/configuration';

export interface ChatResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Thin wrapper over the OpenAI SDK exposing only the two operations the AI engine
 * needs: embeddings (for retrieval) and a deterministic chat completion (for
 * grounded explanations). Centralising it keeps model/config concerns in one place.
 */
@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  // Chat may run on any OpenAI-compatible provider (Groq, Gemini, OpenRouter…)
  // via AI_BASE_URL/AI_API_KEY/AI_CHAT_MODEL. Embeddings always stay on
  // api.openai.com — the stored vectors are 1536-dim text-embedding-3-small,
  // and mixing embedding models would corrupt retrieval.
  private readonly chatClient?: OpenAI;
  private readonly embedClient?: OpenAI;
  private readonly defaultChatModel: string;
  private readonly defaultEmbeddingModel: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const openai = this.config.get('openai', { infer: true });
    this.defaultChatModel = openai.chatModel;
    this.defaultEmbeddingModel = openai.embeddingModel;
    if (openai.chatApiKey) {
      this.chatClient = new OpenAI({ apiKey: openai.chatApiKey, baseURL: openai.chatBaseUrl });
      if (openai.chatBaseUrl) {
        this.logger.log(`Chat provider: ${openai.chatBaseUrl} (model ${openai.chatModel})`);
      }
    } else {
      this.logger.warn('No AI_API_KEY or OPENAI_API_KEY set — AI features will be unavailable.');
    }
    if (openai.apiKey) {
      this.embedClient = new OpenAI({ apiKey: openai.apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY not set — embeddings/retrieval will be unavailable.');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.chatClient);
  }

  get chatModelName(): string {
    return this.defaultChatModel;
  }

  private require(): OpenAI {
    if (!this.chatClient) {
      throw new ServiceUnavailableException('AI service is not configured');
    }
    return this.chatClient;
  }

  private requireEmbed(): OpenAI {
    if (!this.embedClient) {
      throw new ServiceUnavailableException('Embeddings are not configured');
    }
    return this.embedClient;
  }

  /**
   * Embed a batch of texts. Returns one vector per input, in order.
   */
  async embed(texts: string[], model?: string): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const res = await this.requireEmbed().embeddings.create({
      model: model ?? this.defaultEmbeddingModel,
      input: texts,
    });
    return res.data.map((d) => d.embedding);
  }

  async embedOne(text: string, model?: string): Promise<number[]> {
    const [vector] = await this.embed([text], model);
    return vector;
  }

  /**
   * Deterministic chat completion (temperature 0) for grounded answers.
   */
  async chat(system: string, user: string, model?: string): Promise<ChatResult> {
    const chosen = model ?? this.defaultChatModel;
    const res = await this.require().chat.completions.create({
      model: chosen,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return {
      content: res.choices[0]?.message?.content?.trim() ?? '',
      model: chosen,
      promptTokens: res.usage?.prompt_tokens ?? 0,
      completionTokens: res.usage?.completion_tokens ?? 0,
    };
  }

  /**
   * Multi-turn chat completion — a system prompt plus an ongoing message history.
   * Used by the conversational tutor so the model has the full back-and-forth.
   * A small positive temperature keeps replies warm and varied (not robotic).
   */
  async chatMessages(
    system: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    opts?: { temperature?: number; model?: string },
  ): Promise<ChatResult> {
    const chosen = opts?.model ?? this.defaultChatModel;
    const res = await this.require().chat.completions.create({
      model: chosen,
      temperature: opts?.temperature ?? 0.6,
      messages: [{ role: 'system', content: system }, ...history],
    });
    return {
      content: res.choices[0]?.message?.content?.trim() ?? '',
      model: chosen,
      promptTokens: res.usage?.prompt_tokens ?? 0,
      completionTokens: res.usage?.completion_tokens ?? 0,
    };
  }

  /**
   * Chat completion constrained to a single JSON object, parsed into T.
   * Used for structured generation (e.g. question banks).
   */
  async chatJson<T>(system: string, user: string, model?: string): Promise<T> {
    const chosen = model ?? this.defaultChatModel;
    const res = await this.require().chat.completions.create({
      model: chosen,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const content = res.choices[0]?.message?.content ?? '{}';
    return JSON.parse(content) as T;
  }
}
