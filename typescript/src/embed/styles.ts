/*
 * Copyright (c) 2026, PANAXON.AI, LLC. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Multi-Dimensional Neural Elastic Memory Organization (MNEMO) - TypeScript client.
 *
 * Inventor: Edward Suryadi
 * Assignee: PANAXON.AI, LLC
 *
 * Author: edward.suryadi
 * Since: Nov-2026
 */

/** The component's stylesheet. The colours are custom properties, so a page can restyle it from outside, e.g. {@code mnemo-chat { --mnemo-accent: #0a7; }}. */
export const STYLES = `
:host { display: block; width: 100%; height: 480px; min-height: 240px; box-sizing: border-box; contain: content; }
*, *::before, *::after { box-sizing: border-box; }
.root {
  --_bg: var(--mnemo-bg, #ffffff); --_fg: var(--mnemo-fg, #1b1f24); --_muted: var(--mnemo-muted, #5b6470);
  --_border: var(--mnemo-border, #d0d7de); --_accent: var(--mnemo-accent, #0b57d0); --_accent-fg: var(--mnemo-accent-fg, #ffffff);
  --_user: var(--mnemo-user-bg, #e8f0fe); --_bot: var(--mnemo-assistant-bg, #f3f4f6); --_error: var(--mnemo-error, #b3261e);
  --_code: var(--mnemo-code-bg, #eceff3);
  display: flex; flex-direction: column; height: 100%; color: var(--_fg); background: var(--_bg);
  border: 1px solid var(--_border); border-radius: 12px; overflow: hidden;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.root[data-theme="dark"] {
  --_bg: var(--mnemo-bg, #14171c); --_fg: var(--mnemo-fg, #e6e9ee); --_muted: var(--mnemo-muted, #9aa4b2);
  --_border: var(--mnemo-border, #333a44); --_accent: var(--mnemo-accent, #8ab4f8); --_accent-fg: var(--mnemo-accent-fg, #0b1220);
  --_user: var(--mnemo-user-bg, #1d2a44); --_bot: var(--mnemo-assistant-bg, #232830); --_error: var(--mnemo-error, #f2b8b5);
  --_code: var(--mnemo-code-bg, #2b313a);
}
@media (prefers-color-scheme: dark) {
  .root[data-theme="auto"] {
    --_bg: var(--mnemo-bg, #14171c); --_fg: var(--mnemo-fg, #e6e9ee); --_muted: var(--mnemo-muted, #9aa4b2);
    --_border: var(--mnemo-border, #333a44); --_accent: var(--mnemo-accent, #8ab4f8); --_accent-fg: var(--mnemo-accent-fg, #0b1220);
    --_user: var(--mnemo-user-bg, #1d2a44); --_bot: var(--mnemo-assistant-bg, #232830); --_error: var(--mnemo-error, #f2b8b5);
    --_code: var(--mnemo-code-bg, #2b313a);
  }
}
.log { flex: 1 1 auto; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.log:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--_accent); outline-offset: 1px; }
.msg { max-width: 88%; padding: 8px 12px; border-radius: 12px; overflow-wrap: anywhere; }
.msg.user { align-self: flex-end; background: var(--_user); white-space: pre-wrap; }
.msg.assistant { align-self: flex-start; background: var(--_bot); }
.msg > :first-child { margin-top: 0; } .msg > :last-child { margin-bottom: 0; }
.msg p, .msg ul, .msg ol, .msg pre, .msg blockquote { margin: 0 0 8px; }
.msg h3, .msg h4, .msg h5, .msg h6 { margin: 8px 0 4px; font-size: 1em; }
.msg ul, .msg ol { padding-left: 1.4em; }
.msg a { color: var(--_accent); }
.msg code { background: var(--_code); padding: 1px 4px; border-radius: 4px; font: 0.92em ui-monospace, Menlo, Consolas, monospace; }
.msg pre { background: var(--_code); padding: 8px; border-radius: 8px; overflow-x: auto; }
.msg pre code { background: none; padding: 0; }
.msg blockquote { border-left: 3px solid var(--_border); padding-left: 10px; color: var(--_muted); }
.msg hr { border: 0; border-top: 1px solid var(--_border); }
.msg.pending::after { content: "\\2026"; color: var(--_muted); animation: blink 1.2s steps(3, end) infinite; }
@keyframes blink { 0% { opacity: .2; } 50% { opacity: 1; } 100% { opacity: .2; } }
@media (prefers-reduced-motion: reduce) { .msg.pending::after { animation: none; } }
.status, .error { margin: 0; padding: 0 12px; min-height: 0; font-size: 12px; }
.status { color: var(--_muted); }
.error { color: var(--_error); padding-bottom: 6px; }
.status:empty, .error:empty { display: none; }
form { display: flex; gap: 8px; padding: 8px; border-top: 1px solid var(--_border); align-items: flex-end; }
textarea {
  flex: 1 1 auto; resize: none; min-height: 44px; max-height: 140px; padding: 10px; font: inherit; color: inherit;
  background: transparent; border: 1px solid var(--_border); border-radius: 8px;
}
button {
  flex: 0 0 auto; min-width: 44px; min-height: 44px; padding: 0 16px; font: inherit; font-weight: 600; cursor: pointer;
  color: var(--_accent-fg); background: var(--_accent); border: 0; border-radius: 8px;
}
button:disabled { opacity: .5; cursor: default; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;
