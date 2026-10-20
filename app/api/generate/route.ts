import { generateProposal } from "@/lib/groq";
import {
  createGenerationEndpoint,
  createInMemoryGenerationLimiter,
} from "@/lib/generation-endpoint";

export const maxDuration = 30;

const handleGenerationRequest = createGenerationEndpoint({
  hasProviderKey: () => Boolean(process.env.GROQ_API_KEY),
  generate: generateProposal,
  allowRequest: createInMemoryGenerationLimiter(),
});

export const POST = handleGenerationRequest;
