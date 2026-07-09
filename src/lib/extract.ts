import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// The extraction PROPOSAL schema (Section 9). Claude fills this from an uploaded
// quote/contract. It is NEVER authoritative: every field is human-correctable in
// the review UI, and nothing writes to the budget until an explicit Apply.
export const ProposalSchema = z.object({
  vendor_name: z.string().nullable(),
  kind: z.enum(["quote", "contract", "menu", "other"]),
  currency: z.string(), // e.g. "CAD"
  venue_costs: z.array(z.object({ label: z.string(), amount: z.number() })),
  caterers: z.array(
    z.object({ name: z.string(), package: z.string(), price_pp: z.number() })
  ),
  budget_lines: z.array(z.object({ label: z.string(), amount: z.number() })),
  payments: z.array(
    z.object({
      label: z.string(),
      amount: z.number(),
      // Timing captured as a RULE, resolved against the wedding date downstream.
      due: z.object({
        kind: z.enum(["on_booking", "before_event", "absolute", "unknown"]),
        value: z.number().nullable(), // for before_event (e.g. 12)
        unit: z.enum(["days", "weeks", "months", "years"]).nullable(), // for before_event
        date: z.string().nullable(), // ISO, only for a true absolute calendar date
      }),
    })
  ),
  notes: z.string().nullable(),
});

export type Proposal = z.infer<typeof ProposalSchema>;

const SYSTEM = `You extract structured cost data from wedding vendor documents (quotes, contracts, menus) into a proposal a human will review before anything is applied.

Rules:
- Extract ONLY what the document actually states. Do not invent, estimate, or infer amounts that aren't present. Empty arrays are correct when a category has no data.
- All amounts are plain numbers with no currency symbols or commas (e.g. 6500, 4011.75). Per-person catering rates go in caterers.price_pp; totals/flat fees go in venue_costs or budget_lines.
- Map line items to the right bucket: venue/room/bar/landmark fees -> venue_costs; catering packages priced per person -> caterers; florals/photo/attire/insurance/etc -> budget_lines; deposits/installments/payment schedule -> payments.
- payments.due captures WHEN each payment is due as a rule, because contracts usually state timing relative to the event:
    · "due with signed contract" / "at signing" / "at booking" / "deposit to reserve" -> kind "on_booking".
    · "N days/weeks/months/years prior to the event" -> kind "before_event" with value (the number) and unit. PREFER this over any resolved date the document shows in parentheses (e.g. ignore "(Sept 2026)" and capture 12 + months), so the date recomputes if the wedding date changes.
    · a true fixed calendar date the document commits to -> kind "absolute" with date as YYYY-MM-DD.
    · otherwise -> kind "unknown". Set value/unit/date to null when they don't apply.
- Do not include taxes (HST) or service charges as separate line items — those are computed downstream. Capture pre-tax subtotals.
- currency defaults to "CAD" unless the document clearly says otherwise.`;

function contentBlock(data: string, mime: string): Anthropic.ContentBlockParam {
  if (mime === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
    };
  }
  if (mime.startsWith("image/")) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mime as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
        data,
      },
    };
  }
  // Plain text: `data` is the raw UTF-8 text, not base64.
  return {
    type: "document",
    source: { type: "text", media_type: "text/plain", data },
  };
}

// Runs server-side only (Anthropic key never reaches the client). Returns a
// validated proposal + the model id used, for provenance.
export async function extractProposal(input: {
  data: string;
  mime: string;
}): Promise<{ proposal: Proposal; model: string }> {
  const model = "claude-opus-4-8";
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(ProposalSchema) },
    messages: [
      {
        role: "user",
        content: [
          contentBlock(input.data, input.mime),
          {
            type: "text",
            text: "Extract the cost data from this document into the proposal schema.",
          },
        ],
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Extraction failed: model did not return a valid proposal");
  }
  return { proposal: response.parsed_output, model };
}
