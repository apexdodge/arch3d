# arch3d

A small house you walk through in the browser, and edit by typing. The page is React and Three.js. A Cloudflare Worker serves it and answers the chat with Workers AI.

Live: https://arch3d.raytha.workers.dev

The house is JSON, not a model file. Rooms are rectangles in meters. +X is east, +Z is north. Walls are drawn from the rooms. A door is a hole in the wall. A window is a glass pane in that hole. Furniture is a few boxes, not a GLB.

## What you can ask for

The chat is the only control. Name the room. There is nothing to click.

You can add a room, knock out a shared wall when the two rooms make one rectangle, and add or remove a door or a window. You can paint a floor, one wall, or all four walls. Wall paint does not change the floor. Colors are oak, white, sage, terracotta, cream, ink, and sand.

Furniture is a bed, sofa, table, toilet, sink, floor lamp, ceiling light, cabinet, dresser, side table, fridge, or stove. Ask to put the long side against a wall and it turns to face that wall. Ask to move it north, south, east, or west. "Remove the toilet" takes that piece out. If a piece does not fit, the reply says so and leaves the house alone.

The starter house is a living room, kitchen, bedroom, and bath, ceiling 2.7 m, with a door between each pair and a window on an outside wall. No furniture yet. Try "Dress the bedroom" or "Paint the kitchen walls terracotta."

A few lines never go to the model. They have to match aside from case and a trailing period:

- `undo`, `undo that`, or `undo last`
- `reset`, `reset the house`, or `start over`
- `clear`, `clear chat`, or `clear the chat`

`please reset the house` goes to the model and will not reset anything. Ctrl+Z undoes when the chat box is not focused. Reset restores the starter house and keeps the chat log. Clear wipes the log and keeps the house.

The house is saved in this browser under `arch3d-house`. The chat log is not. Reload clears the chat. The worker does not store either one. There is no D1 and no R2.

## Walking

WASD moves on your current heading even when you are not looking around. Space goes up. Ctrl goes down. Shift is about four times faster. F locks the mouse so you can look. F does nothing while you are typing. The compass is your yaw. North is +Z. The card in the corner is the room you are standing in, with its floor color and the color of each wall.

## Cloudflare

You need a Cloudflare account with Workers AI turned on. That is the only binding. Wrangler is a dev dependency, so `npm install` gets it. Log in once:

```bash
npx wrangler login
```

`npm run deploy` builds, then runs `wrangler deploy` against whatever account that login belongs to. The worker name in `wrangler.jsonc` is `arch3d`. The public URL is that name plus your workers.dev subdomain. `/api/*` hits the worker. Everything else is the single-page app.

Chat is `POST /api/chat`. The worker calls `@cf/zai-org/glm-4.7-flash` once, applies whatever tools came back, and replies with what those tools actually did. A second confirmation call was slower than it was worth. Each call is billed as Workers AI usage on the logged-in account, including `npm run dev`, because the AI binding still reaches the remote model.

## Run it

Node 20.19 or newer, or Node 22.12 or newer. Vite 8 will refuse anything older.

```bash
npm install
npm run dev
npm run deploy
```

`npm run dev` is the Vite dev server with the worker. `npm run build` is `tsc -b` and a Vite build. `npm run preview` serves that build locally.

Edits live in `src/house.ts`. The page and the worker both call those functions, so a chat edit and a direct edit cannot drift. `worker/index.ts` is the model call. `src/HouseView.tsx` draws the house. `src/FlyCamera.tsx` is the walk.
