import type { Transcriber, TranscriptionInput } from "./types";

/** Returns a canned transcript so the upload flow can be demoed without an API key. */
export class MockTranscriber implements Transcriber {
  readonly mode = "mock" as const;
  async transcribe(_input: TranscriptionInput) {
    return {
      text: `Broker: Thanks for calling, who do I have?
Investor: Hi, this is Jordan Ellison. I'm under contract on a single family rental at 4127 Juniper Ridge Drive, Boise, ID 83709. Purchase price is $389,000.
Broker: Great. How much are you planning to put down?
Investor: About 25% down. My credit score is around 731.
Broker: And what will it rent for?
Investor: The current lease is $2,650 a month and the tenant wants to stay. Taxes are about $310 a month and insurance runs around $140.
Investor: I want to keep cash flow positive and I'm hoping to buy two more this year. I'm worried the rate will be too high, and I don't like long prepayment penalties.
Broker: Understood. I'll send you a few options by Thursday, including a shorter 3-2-1 prepay and an interest-only option.
Investor: Sounds good. You can email me at jordan.ellison@example.test.`,
      durationSec: 240,
    };
  }
}
