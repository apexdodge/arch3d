import {
  applyEdit,
  describeHouse,
  editFromTool,
  parseHouse,
  parseWallRef,
  type House,
  type WallRef,
} from "../src/house.ts";

const model = "@cf/zai-org/glm-4.7-flash";

type Env = {
  AI: Ai;
};

type ChatLine = {
  role: "user" | "assistant";
  text: string;
};

type ToolCall = {
  id: string;
  name: string;
  arguments: unknown;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return new Response(null, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ reply: "The request was not JSON." }, { status: 400 });
    }

    const parsed = parseChatRequest(body);
    if (!parsed) {
      return Response.json({ reply: "The house in that request is not valid." }, { status: 400 });
    }

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt(parsed.house, parsed.selection) },
      ...parsed.history.map((line) => ({ role: line.role, content: line.text })),
      { role: "user", content: parsed.message },
    ];

    let house = parsed.house;

    try {
      const output = await env.AI.run(model, {
        messages,
        tools,
        parallel_tool_calls: true,
      });
      const calls = readCalls(output);
      const content = output.choices[0]?.message.content?.trim() ?? "";
      if (calls.length === 0) {
        return Response.json({
          reply: content || "Nothing to change.",
          house,
        });
      }
      const results = applyCalls(house, calls, parsed.selection);
      const summary = results.notes.map((note) => note.text).join(" ");
      return Response.json({
        reply: summary || content || "Done.",
        house: results.house,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The model request failed.";
      return Response.json({ reply: message, house });
    }
  },
} satisfies ExportedHandler<Env>;

function systemPrompt(house: House, selection: WallRef | null): string {
  return [
    "You edit a house by calling tools. Put every tool call and one short sentence in the same response.",
    "Call every tool the request needs, in order, in one response when you can.",
    "Use room names. Do not ask the person to click. There is no selected wall.",
    "If the room or the wall is ambiguous, ask one short question and call no tools.",
    "If the request is clear, do it. Do not wait for a yes.",
    "width runs along the wall. depth extrudes outward. Omit width to match the wall. Omit depth for 3 meters.",
    "A door is 0.9 by 2.1 at the floor. A window is 1.2 by 1.1 with sill 0.9. If no side is given, the longest exterior wall is used.",
    "Colors are oak, white, sage, terracotta, cream, ink, or sand.",
    "setColor target is floor, walls, or one side. walls paints all four walls and leaves the floor alone.",
    "To dress a room, call placeFurniture once per piece that fits. Use against so the long side sits on a wall.",
    "x and z are meters from that room's southwest corner. Omit them for a sensible spot.",
    "placeFurniture always adds. Call removeFurniture to take a piece out. Do not place the same piece twice.",
    "Leave a walking gap. Do not cover a door. If a piece does not fit, skip it and place the next.",
    "moveFurniture against a wall turns the piece so its long side is against that wall.",
    "removeOpening removes a door or window. removeRoom deletes a room. openWall joins two rooms when they form one rectangle.",
    describeHouse(house, selection),
  ].join("\n");
}

function applyCalls(
  house: House,
  calls: ToolCall[],
  selection: WallRef | null,
): { house: House; notes: Array<{ id: string; text: string }> } {
  let current = house;
  const notes: Array<{ id: string; text: string }> = [];
  for (const call of calls) {
    const edit = editFromTool(current, call.name, call.arguments, selection);
    if (!edit.ok) {
      notes.push({ id: call.id, text: edit.message });
      continue;
    }
    const applied = applyEdit(current, edit.edit);
    if (!applied.ok) {
      notes.push({ id: call.id, text: applied.message });
      continue;
    }
    current = applied.house;
    notes.push({ id: call.id, text: applied.summary });
  }
  return { house: current, notes };
}

const tools: ChatCompletionTool[] = [
  tool("addRoom", "Add a room outside an existing room. room is the existing room name. name is the new room.", {
    room: { type: "string", description: "Existing room name" },
    side: { type: "string", description: "north, south, east, or west. Omit to use the longest exterior wall." },
    name: { type: "string", description: "Name of the new room" },
    width: { type: "number", description: "Meters along the wall" },
    depth: { type: "number", description: "Meters outward" },
  }, ["room", "name"]),
  tool("addOpening", "Add a door or window. Omit side to use the longest exterior wall.", {
    room: { type: "string", description: "Room name" },
    side: { type: "string", description: "north, south, east, or west" },
    opening: { type: "string", description: "door or window" },
    offset: { type: "number", description: "Meters from the start of the wall" },
    width: { type: "number", description: "Meters" },
    height: { type: "number", description: "Meters" },
    sill: { type: "number", description: "Meters from the floor" },
  }, ["room", "opening"]),
  tool("removeOpening", "Remove a door or window.", {
    room: { type: "string", description: "Room name" },
    side: { type: "string", description: "north, south, east, or west" },
    opening: { type: "string", description: "door or window" },
  }, ["room"]),
  tool("removeRoom", "Remove a room.", {
    room: { type: "string", description: "Room name" },
  }, ["room"]),
  tool("openWall", "Join this room to the neighbor through a shared wall, if the result is one rectangle.", {
    room: { type: "string", description: "Room name" },
    side: { type: "string", description: "Shared wall: north, south, east, or west" },
  }, ["room", "side"]),
  tool("setColor", "Paint a floor, one wall, or all four walls. Does not paint the floor when target is walls.", {
    room: { type: "string", description: "Room name" },
    color: { type: "string", description: "oak, white, sage, terracotta, cream, ink, or sand" },
    target: { type: "string", description: "floor, walls, north, south, east, or west. Omit for the floor." },
  }, ["room", "color"]),
  tool("placeFurniture", "Add one piece. Pass against so the long side sits on that wall. x and z are meters from the room's southwest corner. Omit against, x, and z for a sensible spot.", {
    room: { type: "string", description: "Room name" },
    furniture: { type: "string", description: "bed, sofa, table, toilet, sink, floorLamp, ceilingLight, cabinet, dresser, sideTable, fridge, or stove" },
    against: { type: "string", description: "north, south, east, or west. Long side goes against this wall." },
    x: { type: "number", description: "Meters east from the room's southwest corner" },
    z: { type: "number", description: "Meters north from the room's southwest corner" },
    yaw: { type: "number", description: "0, 90, 180, or 270. Omit when using against." },
  }, ["room", "furniture"]),
  tool("removeFurniture", "Remove one piece from a room.", {
    room: { type: "string", description: "Room name" },
    furniture: { type: "string", description: "bed, sofa, table, toilet, sink, floorLamp, ceilingLight, cabinet, dresser, sideTable, fridge, or stove" },
  }, ["room", "furniture"]),
  tool("moveFurniture", "Move a piece by a direction, or set against a wall so the long side sits on that wall.", {
    room: { type: "string", description: "Room name" },
    furniture: { type: "string", description: "The piece already in the room" },
    direction: { type: "string", description: "north, south, east, or west" },
    against: { type: "string", description: "Wall the long side should sit against" },
    distance: { type: "number", description: "Meters. Omit for 0.5." },
  }, ["room", "furniture"]),
];

function tool(
  name: string,
  description: string,
  properties: Record<string, { type: string; description: string }>,
  required: string[],
): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: { type: "object", properties, required },
    },
  };
}

function parseChatRequest(
  value: unknown,
): { house: House; selection: WallRef | null; message: string; history: ChatLine[] } | null {
  if (!isRecord(value)) {
    return null;
  }
  const house = parseHouse(value.house);
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!house || message.length === 0 || message.length > 800) {
    return null;
  }
  const selection = value.selection == null ? null : parseWallRef(value.selection);
  return { house, selection, message, history: parseHistory(value.history) };
}

function parseHistory(value: unknown): ChatLine[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const lines: ChatLine[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if ((item.role !== "user" && item.role !== "assistant") || text.length === 0 || text.length > 800) {
      continue;
    }
    lines.push({ role: item.role, text });
  }
  return lines.slice(-12);
}

function readCalls(output: ChatCompletionsOutput): ToolCall[] {
  const calls = output.choices[0]?.message.tool_calls;
  if (!calls) {
    return [];
  }
  const found: ToolCall[] = [];
  for (const call of calls) {
    if (call.type === "function") {
      found.push({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      });
    }
  }
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
